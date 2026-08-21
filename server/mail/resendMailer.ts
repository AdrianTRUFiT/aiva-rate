import type { Mailer, OutboundMessage, SentMessage } from './types';

/**
 * Sends through Resend's HTTP API. Chosen because it needs no SDK — one POST
 * with a bearer token — which keeps the dependency list unchanged.
 */
export class ResendMailer implements Mailer {
  readonly name = 'resend' as const;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: OutboundMessage): Promise<SentMessage> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        // Resend de-duplicates on this, so a retried sweep cannot double-send.
        'Idempotency-Key': message.key,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!res.ok) {
      throw new Error(`resend send failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }

    const body = (await res.json()) as { id: string };
    return { messageId: body.id, channel: 'email' };
  }
}
