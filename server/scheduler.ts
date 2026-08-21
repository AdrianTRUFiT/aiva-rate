import { config } from './config';
import { PLAN_LENGTH, dayOf, isComplete, pendingDeliveries, type Clock } from './delivery';
import { getMailer } from './mail';
import { dailyMessage } from './messages';
import type { Enrollment, EnrollmentRepository } from './store/types';

/**
 * The delivery sweep.
 *
 * Finds every active enrolment with a day that has unlocked but not been sent,
 * sends it, and records the send. Safe to run as often as you like: the record
 * of what has been delivered lives on the enrolment, so a day already sent is
 * never sent again — which matters because the failure mode here is mailing
 * somebody the same exercise four times.
 */

export interface SweepResult {
  enrollmentId: string;
  day: number;
  messageId: string;
}

export async function sweep(repo: EnrollmentRepository, clock: Clock): Promise<SweepResult[]> {
  const now = clock();
  const sent: SweepResult[] = [];

  for (const enrollment of await repo.active()) {
    for (const day of pendingDeliveries(enrollment, now)) {
      const planDay = dayOf(enrollment, day);
      if (!planDay) continue;

      const message = dailyMessage(
        enrollment.email,
        planDay,
        `${config.appUrl}/?resume=1`,
        day === PLAN_LENGTH,
      );

      let messageId: string;
      try {
        const result = await getMailer().send({ ...message, key: `${enrollment.id}-${message.key}` });
        messageId = result.messageId;
      } catch (err) {
        // One failing address must not stall the sweep for everyone else. The
        // day stays pending and is retried on the next pass.
        console.error(`[delivery] ${enrollment.id} day ${day} failed:`, (err as Error).message);
        continue;
      }

      // Recorded only after a successful send, so a crash mid-sweep re-sends
      // rather than silently skipping a day.
      await repo.update(enrollment.id, (e) => ({
        ...e,
        deliveries: [...e.deliveries, { day, sentAt: now.toISOString(), channel: 'email', messageId }],
      }));

      sent.push({ enrollmentId: enrollment.id, day, messageId });
    }

    const refreshed = await repo.get(enrollment.id);
    if (refreshed && refreshed.status === 'active' && isComplete(refreshed, now)) {
      await repo.update(refreshed.id, (e) => ({ ...e, status: 'completed' }));
    }
  }

  return sent;
}

/**
 * Pauses an enrolment because a check-in tripped the safety screen.
 *
 * Delivery stops immediately. The person keeps their access — the week is
 * theirs and they paid for it — but nothing further is pushed at them.
 */
export async function safetyPause(
  repo: EnrollmentRepository,
  id: string,
  categories: string[],
  clock: Clock,
): Promise<Enrollment> {
  return repo.update(id, (e) => ({
    ...e,
    status: 'paused_safety',
    safety: { pausedAt: clock().toISOString(), categories },
  }));
}

/** Starts the periodic sweep. Returns a stop function. */
export function startScheduler(repo: EnrollmentRepository, clock: Clock, intervalMs = 60_000): () => void {
  const run = () => {
    sweep(repo, clock).catch((err) => console.error('[delivery] sweep failed:', err));
  };
  const timer = setInterval(run, intervalMs);
  // Never hold the process open just for the scheduler.
  timer.unref?.();
  run();
  return () => clearInterval(timer);
}
