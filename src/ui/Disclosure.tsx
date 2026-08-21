import { Bot } from 'lucide-react';

/**
 * Standing AI disclosure.
 *
 * Present on every screen where a persona speaks, not tucked into a footer or a
 * settings page. The personas are designed to feel human; that is precisely why
 * this cannot be subtle.
 */
export const Disclosure = () => (
  <div className="flex items-start gap-2 text-xs text-muted">
    <Bot size={14} className="mt-0.5 shrink-0" />
    <p>
      You are talking to an AI guide, not a person, and not a therapist. Nothing here is
      medical or psychological treatment.
    </p>
  </div>
);
