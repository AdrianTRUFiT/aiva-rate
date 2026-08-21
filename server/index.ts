import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { config, mailLive, secretIsEphemeral, stripeLive } from './config';
import { FileEnrollmentRepository } from './store/fileStore';
import { paymentProvider } from './payments';
import { buildDevRoutes, buildRoutes } from './routes';
import { FileDiceRepository } from './dice/store';
import { buildDiceRoutes } from './dice/routes';
import { initOperatorAuth } from './dice/auth';
import { signalSource } from './dice/sources';
import { startScheduler } from './scheduler';
import { appClock } from './clock';

/**
 * The API server.
 *
 * In development Vite proxies /api here. In production this also serves the
 * built client from dist/, so the whole thing is one process.
 */

const secret = config.secret || randomBytes(32).toString('hex');
const repo = new FileEnrollmentRepository(config.dataDir);
const payments = paymentProvider(secret);
const deps = { repo, payments, clock: appClock, devSecret: secret };

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    payments: payments.name,
    mail: mailLive() ? 'resend' : 'file',
    time: new Date().toISOString(),
  });
});

app.use('/api', buildRoutes(deps));

// DICE — the operator console. Every route below sits behind operator auth.
const diceRepo = new FileDiceRepository(config.dataDir);
const operatorAuth = initOperatorAuth(config.operator.password, secret);
app.use('/api/dice', buildDiceRoutes({ repo: diceRepo, auth: operatorAuth, clock: appClock }));

// The stand-in checkout page exists only when there is no real Stripe key, so
// it can never be reachable in a deployment that takes actual payments.
if (!stripeLive()) app.use('/api', buildDevRoutes(deps));

const dist = join(process.cwd(), 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  // Client-side routing: anything not under /api falls through to the app.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

startScheduler(repo, appClock);

app.listen(config.port, () => {
  console.log(`[pw] listening on :${config.port}`);
  console.log(`[pw] payments: ${payments.name}${stripeLive() ? '' : ' (local stand-in — no Stripe key)'}`);
  console.log(`[pw] mail: ${mailLive() ? 'resend' : `file (${join(config.dataDir, 'outbox')})`}`);
  if (secretIsEphemeral()) {
    console.warn('[pw] SESSION_SECRET is unset — resume links will not survive a restart.');
  }
  if (!stripeLive()) {
    console.warn('[pw] STRIPE_SECRET_KEY is unset — no real payments can be taken.');
  }
  console.log(`[dice] signal source: ${signalSource().name}`);
  if (operatorAuth.ephemeral) {
    console.warn(`[dice] OPERATOR_PASSWORD is unset. This run's password: ${operatorAuth.password}`);
  }
});
