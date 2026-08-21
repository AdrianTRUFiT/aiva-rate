import type { Clock } from './delivery';

/**
 * A clock with a settable offset.
 *
 * The whole product is defined by what happens across days, so "come back
 * tomorrow" has to be exercisable without waiting a day. The offset is only
 * reachable through the dev routes, which are mounted only when there is no
 * real Stripe key — a deployment taking real payments has no way to move it.
 */
let offsetMs = 0;

export const appClock: Clock = () => new Date(Date.now() + offsetMs);

export const setClockOffsetHours = (hours: number): void => {
  offsetMs = hours * 3_600_000;
};

export const clockOffsetHours = (): number => offsetMs / 3_600_000;
