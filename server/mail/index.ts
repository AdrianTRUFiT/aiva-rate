import { join } from 'node:path';
import { config, mailLive } from '../config';
import { FileMailer } from './fileMailer';
import { ResendMailer } from './resendMailer';
import type { Mailer } from './types';

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;
  mailer = mailLive()
    ? new ResendMailer(config.mail.resendKey, config.mail.from)
    : new FileMailer(join(config.dataDir, 'outbox'));
  return mailer;
}

/** Test seam. */
export function setMailer(m: Mailer | null): void {
  mailer = m;
}

export type { Mailer, OutboundMessage, SentMessage } from './types';
