export interface OutboundMessage {
  to: string;
  subject: string;
  text: string;
  /** Idempotency key — the same key must never send twice. */
  key: string;
}

export interface SentMessage {
  messageId: string;
  channel: 'email';
}

export interface Mailer {
  readonly name: 'resend' | 'file';
  send(message: OutboundMessage): Promise<SentMessage>;
}
