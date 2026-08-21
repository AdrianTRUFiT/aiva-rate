import express, { type Request, type Response, type Router } from 'express';
import { PRESSURE_MOMENTS } from '../src/pw/pressure';
import { PERSONAS } from '../src/pw/personas';
import { INTERVENTIONS } from '../src/pw/interventions';
import { evaluateOffer } from '../src/pw/funnel';
import { screen } from '../src/pw/safety';
import { RESET_OFFER } from '../src/pw/continuity';
import type { SessionState } from '../src/pw/types';
import { config } from './config';
import {
  clearResumeCookie,
  hashToken,
  issueResumeToken,
  newEnrollmentId,
  normaliseEmail,
  readResumeCookie,
  resumeCookie,
} from './identity';
import { PLAN_LENGTH, currentDay, dayOf, resumeView, type Clock } from './delivery';
import { getMailer } from './mail';
import { safetyPauseMessage, welcomeMessage } from './messages';
import { safetyPause, sweep } from './scheduler';
import type { PaymentProvider } from './payments';
import type { EnrollRequest, EnrollResponse } from './api';
import { MockCheckoutProvider } from './payments/mock';
import { clockOffsetHours, setClockOffsetHours } from './clock';
import type { Enrollment, EnrollmentRepository } from './store/types';

export interface RouteDeps {
  repo: EnrollmentRepository;
  payments: PaymentProvider;
  clock: Clock;
  /** Signs the local stand-in webhook. Unused with real Stripe. */
  devSecret: string;
}

const bad = (res: Response, status: number, error: string, gate?: string) =>
  res.status(status).json(gate ? { error, gate } : { error });

const secureCookies = () => config.appUrl.startsWith('https://');

/**
 * Rebuilds enough of a session for the offer gate to run server-side.
 *
 * The gate protects the person from the business, not the business from the
 * person: forging this evidence only lets somebody buy a thing they could have
 * bought anyway, so client-reported evidence is an acceptable input. What it
 * must never do is let the *server* create a charge on a path the gate would
 * have refused — hence re-deciding here rather than trusting the browser's
 * conclusion.
 */
const sessionFromEvidence = (body: EnrollRequest): SessionState => ({
  id: 'server-eval',
  startedAt: new Date().toISOString(),
  stage: 'TRANSFORMATION',
  outcome: 'IN_PROGRESS',
  statement: '', // never transmitted, never stored
  pressure: body.pressure,
  persona: body.persona,
  intervention: INTERVENTIONS.find((i) => i.id === body.intervention) ?? null,
  interventionCompleted: body.evidence.interventionCompleted,
  shift: body.evidence.shift,
  attempts: body.evidence.attempts,
  events: [],
  safetyRouted: body.evidence.safetyRouted,
});

export function buildRoutes(deps: RouteDeps): Router {
  const { repo, payments, clock } = deps;
  const router = express.Router();

  /* --------------------------------------------------------------------- */
  /* Enrolment — the only point at which anything leaves the browser.       */
  /* --------------------------------------------------------------------- */
  router.post('/enroll', express.json({ limit: '8kb' }), async (req: Request, res: Response) => {
    const body = req.body as EnrollRequest;

    if (!body?.evidence || typeof body.email !== 'string') return bad(res, 400, 'malformed request');

    const email = normaliseEmail(body.email);
    if (!email) return bad(res, 400, 'that email address does not look right');

    // Reject unknown identifiers outright rather than letting them reach the
    // plan builder, where an unknown pressure would throw deep in a helper.
    if (!PRESSURE_MOMENTS[body.pressure]) return bad(res, 400, 'unknown pressure moment');
    if (!PERSONAS[body.persona]) return bad(res, 400, 'unknown guide');
    if (!INTERVENTIONS.some((i) => i.id === body.intervention)) return bad(res, 400, 'unknown exercise');

    // The gate, re-decided here. This is the line that makes "earn the
    // transaction" a property of the system rather than of the page copy.
    const decision = evaluateOffer(sessionFromEvidence(body));
    if (!decision.allowed) return bad(res, 403, 'no offer is available for this session', decision.reason);

    const { token, hash } = issueResumeToken();
    const id = newEnrollmentId();

    const enrollment: Enrollment = {
      id,
      createdAt: clock().toISOString(),
      pressure: body.pressure,
      entryPersona: body.persona,
      entryIntervention: body.intervention,
      email,
      status: 'pending_payment',
      payment: {
        provider: payments.name,
        checkoutId: null,
        paidAt: null,
        amountCents: config.stripe.priceCents,
        currency: config.stripe.currency,
      },
      startedAt: null,
      days: [],
      deliveries: [],
      resumeTokenHash: hash,
      safety: null,
    };

    await repo.create(enrollment);

    let checkout;
    try {
      checkout = await payments.createCheckout({
        enrollmentId: id,
        email,
        amountCents: config.stripe.priceCents,
        currency: config.stripe.currency,
        productName: RESET_OFFER.name,
        successUrl: `${config.appUrl}/?enrolled=${id}`,
        cancelUrl: `${config.appUrl}/?cancelled=${id}`,
      });
    } catch (err) {
      await repo.update(id, (e) => ({ ...e, status: 'cancelled' }));
      return bad(res, 502, `could not start checkout: ${(err as Error).message}`);
    }

    await repo.update(id, (e) => ({ ...e, payment: { ...e.payment, checkoutId: checkout.id } }));

    res.setHeader('Set-Cookie', resumeCookie(token, secureCookies()));
    const payload: EnrollResponse = {
      enrollmentId: id,
      checkoutUrl: checkout.url,
      provider: checkout.provider,
    };
    res.json(payload);
  });

  /* --------------------------------------------------------------------- */
  /* Payment webhook — the only thing that marks an enrolment paid.         */
  /* --------------------------------------------------------------------- */
  router.post(
    '/payments/webhook',
    express.raw({ type: '*/*', limit: '1mb' }),
    async (req: Request, res: Response) => {
      let event;
      try {
        event = payments.parseWebhook(req.body as Buffer, req.headers);
      } catch (err) {
        // An unverifiable webhook is dropped, never processed on trust.
        return bad(res, 400, `webhook rejected: ${(err as Error).message}`);
      }

      if (event.type !== 'payment.completed') return res.json({ received: true, ignored: true });

      const enrollment =
        (event.enrollmentId ? await repo.get(event.enrollmentId) : null) ??
        (event.checkoutId ? await repo.findByCheckoutId(event.checkoutId) : null);

      if (!enrollment) return bad(res, 404, 'no enrolment for that payment');

      // Stripe retries until it gets a 2xx, so the same event arrives more than
      // once as a matter of course. Confirming twice must be a no-op.
      if (enrollment.status !== 'pending_payment') {
        return res.json({ received: true, alreadyProcessed: true });
      }

      const now = clock();
      const started = await repo.update(enrollment.id, (e) => ({
        ...e,
        status: 'active',
        startedAt: now.toISOString(),
        payment: { ...e.payment, paidAt: now.toISOString(), checkoutId: event.checkoutId ?? e.payment.checkoutId },
      }));

      // Welcome first, then whatever days are already due (day 1, immediately).
      const mailer = getMailer();
      const link = `${config.appUrl}/?resume=1`;
      await mailer.send(welcomeMessage(started.email, link));
      await sweep(repo, clock);

      res.json({ received: true });
    },
  );

  /* --------------------------------------------------------------------- */
  /* Resume — a returning person, recognised by cookie or emailed link.     */
  /* --------------------------------------------------------------------- */
  const loadFromRequest = async (req: Request): Promise<Enrollment | null> => {
    const fromQuery = typeof req.query.token === 'string' ? req.query.token : null;
    const token = fromQuery ?? readResumeCookie(req.headers.cookie);
    if (!token) return null;
    return repo.findByResumeTokenHash(hashToken(token));
  };

  router.get('/session', async (req: Request, res: Response) => {
    const enrollment = await loadFromRequest(req);
    if (!enrollment) {
      res.setHeader('Set-Cookie', clearResumeCookie());
      return bad(res, 404, 'no active week');
    }

    // A link arriving by email re-establishes the cookie on this device.
    if (typeof req.query.token === 'string') {
      res.setHeader('Set-Cookie', resumeCookie(req.query.token, secureCookies()));
    }

    res.json(resumeView(enrollment, clock()));
  });

  /* --------------------------------------------------------------------- */
  /* Daily check-in.                                                        */
  /* --------------------------------------------------------------------- */
  router.post('/checkin', express.json({ limit: '8kb' }), async (req: Request, res: Response) => {
    const enrollment = await loadFromRequest(req);
    if (!enrollment) return bad(res, 404, 'no active week');
    if (enrollment.status === 'paused_safety') return bad(res, 409, 'this week is paused');
    if (enrollment.status !== 'active') return bad(res, 409, 'this week is not active');

    const { day, rating, note } = req.body as { day: number; rating: number | null; note: string };
    const unlocked = currentDay(enrollment, clock());

    if (!Number.isInteger(day) || day < 1 || day > PLAN_LENGTH) return bad(res, 400, 'no such day');
    if (unlocked === null || day > unlocked) return bad(res, 409, 'that day has not opened yet');

    const text = typeof note === 'string' ? note.slice(0, 4000) : '';

    // The safety policy requires every piece of free text to be screened, not
    // just the first one. This is the check-in half of that.
    const signal = screen(text);
    if (signal.level === 'route') {
      const paused = await safetyPause(repo, enrollment.id, signal.categories, clock);
      await getMailer().send(safetyPauseMessage(paused.email, `${config.appUrl}/?resume=1`));
      return res.json({ ok: true, routedToSupport: true, view: resumeView(paused, clock()) });
    }

    const updated = await repo.update(enrollment.id, (e) => {
      const days = e.days.filter((d) => d.day !== day);
      days.push({
        day,
        completedAt: clock().toISOString(),
        note: text || null,
        rating: typeof rating === 'number' && rating >= 1 && rating <= 10 ? rating : null,
      });
      days.sort((a, b) => a.day - b.day);
      return { ...e, days };
    });

    res.json({ ok: true, view: resumeView(updated, clock()) });
  });

  /* --------------------------------------------------------------------- */
  /* Today's exercise, for the returning browser.                           */
  /* --------------------------------------------------------------------- */
  router.get('/today', async (req: Request, res: Response) => {
    const enrollment = await loadFromRequest(req);
    if (!enrollment) return bad(res, 404, 'no active week');

    const unlocked = currentDay(enrollment, clock());
    if (unlocked === null) return bad(res, 409, 'this week has not started');

    const day = dayOf(enrollment, unlocked);
    if (!day) return bad(res, 500, 'plan is missing that day');

    res.json({
      day: day.day,
      name: day.intervention.name,
      premise: day.intervention.premise,
      steps: day.intervention.steps,
      checkIn: day.checkIn,
      checkpointQuestion: day.intervention.checkpointQuestion,
      alreadyLogged: enrollment.days.some((d) => d.day === day.day && d.completedAt),
    });
  });

  return router;
}

/** Routes that only exist when the local payment stand-in is in use. */
export function buildDevRoutes(deps: RouteDeps): Router {
  const router = express.Router();
  const { repo, clock } = deps;

  /**
   * Stands in for Stripe's hosted checkout page. Confirms by calling the same
   * webhook endpoint with a valid signature, so nothing here bypasses the
   * verification path that real payments go through.
   */
  router.get('/dev/checkout', async (req: Request, res: Response) => {
    const { session, enrollment, amount, currency, success, cancel } = req.query as Record<string, string>;
    const price = ((Number(amount) || 0) / 100).toFixed(2);

    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Checkout (local)</title>
<style>
 body{font:15px/1.6 ui-sans-serif,system-ui;background:#f6f7f9;color:#3d4a58;
      display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
 .c{background:#fff;border:1px solid #dde3ea;border-radius:16px;padding:32px;max-width:420px}
 h1{margin:0 0 4px;font-size:20px;color:#16202b}
 .n{background:#fff8e6;border:1px solid #e8d9a8;border-radius:10px;padding:12px;font-size:13px;margin:20px 0}
 button{background:#2f5d8a;color:#fff;border:0;border-radius:100px;padding:11px 24px;font:inherit;font-weight:600;cursor:pointer}
 a{color:#6b7a8a;font-size:13px;margin-left:16px}
</style></head><body><div class="c">
<h1>${price} ${String(currency || 'usd').toUpperCase()}</h1>
<div>7-Day Under Pressure Reset</div>
<div class="n"><strong>Local payment stand-in.</strong> No Stripe key is configured, so this
page replaces Stripe Checkout. Confirming fires a signed webhook through the same
verification path a real payment uses. No card is taken and no money moves.</div>
<form method="POST" action="/api/dev/checkout/confirm">
  <input type="hidden" name="session" value="${session ?? ''}">
  <input type="hidden" name="enrollment" value="${enrollment ?? ''}">
  <input type="hidden" name="success" value="${success ?? '/'}">
  <button type="submit">Confirm payment</button>
  <a href="${cancel ?? '/'}">Cancel</a>
</form></div></body></html>`);
  });

  router.post(
    '/dev/checkout/confirm',
    express.urlencoded({ extended: false }),
    async (req: Request, res: Response) => {
      const { session, enrollment, success } = req.body as Record<string, string>;

      const body = Buffer.from(
        JSON.stringify({
          id: `evt_mock_${Date.now()}`,
          type: 'payment.completed',
          checkoutId: session,
          enrollmentId: enrollment,
        }),
        'utf8',
      );

      const signature = new MockCheckoutProvider(deps.devSecret, config.appUrl).sign(body);

      const result = await fetch(`${config.appUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mock-signature': signature },
        body,
      });

      if (!result.ok) return bad(res, 502, `stand-in webhook failed: ${await result.text()}`);
      res.redirect(303, success || '/');
    },
  );

  /**
   * Moves the server clock and runs the delivery sweep, so a seven-day product
   * can be walked end to end without waiting seven days.
   */
  router.post('/dev/clock', express.json(), async (req: Request, res: Response) => {
    const { offsetHours } = (req.body ?? {}) as { offsetHours?: number };
    if (typeof offsetHours === 'number') setClockOffsetHours(offsetHours);
    const sent = await sweep(repo, clock);
    res.json({ offsetHours: clockOffsetHours(), now: clock().toISOString(), sent });
  });

  return router;
}
