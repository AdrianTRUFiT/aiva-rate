import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Mailer, OutboundMessage, SentMessage } from './types';

/**
 * Writes each message to a file instead of sending it.
 *
 * Used whenever no mail provider is configured. The point is that "delivery
 * outside the browser" is genuinely exercised — the scheduler runs, the
 * message is composed, idempotency is enforced — with the final hop landing in
 * ./outbox where it can be read. Swapping in a real provider changes one line
 * of configuration.
 */
export class FileMailer implements Mailer {
  readonly name = 'file' as const;

  constructor(private readonly dir: string) {}

  async send(message: OutboundMessage): Promise<SentMessage> {
    await mkdir(this.dir, { recursive: true });
    const messageId = randomUUID();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(this.dir, `${stamp}_${message.key}.txt`);

    await writeFile(
      file,
      [
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        `X-Idempotency-Key: ${message.key}`,
        `X-Message-Id: ${messageId}`,
        '',
        message.text,
        '',
      ].join('\n'),
      'utf8',
    );

    await appendFile(join(this.dir, 'index.log'), `${new Date().toISOString()} ${message.to} ${message.subject}\n`, 'utf8');
    return { messageId, channel: 'email' };
  }
}
