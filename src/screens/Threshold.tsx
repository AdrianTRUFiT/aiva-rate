import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { Disclosure } from '../ui/Disclosure';

/**
 * SoulHost — the threshold.
 *
 * One question, asked once, in plain language. No account, no menu of
 * categories, no "how did you hear about us". The only job of this screen is to
 * make a person feel heard enough to begin.
 */
export const Threshold = () => {
  const [text, setText] = useState('');
  const submit = useSession((s) => s.submitStatement);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-10">
        <div className="space-y-5">
          <p className="eyebrow">Performance Wellness</p>
          <h1 className="text-3xl md:text-[40px] leading-[1.15]">
            What is putting the most pressure on you right now?
          </h1>
          <p className="text-body prose-measure">
            You don't need to explain everything perfectly, and you don't need to start at the
            beginning. Start with one thing.
          </p>
        </div>

        <div className="space-y-4">
          <label htmlFor="statement" className="sr-only">
            What is putting the most pressure on you right now?
          </label>
          <textarea
            id="statement"
            autoFocus
            className="input-field min-h-[140px] resize-none text-[16px]"
            placeholder="In your own words…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) submit(text);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted">
              Stays in your browser. Nothing is sent anywhere and no account is created.
            </p>
            <button
              onClick={() => submit(text)}
              disabled={!text.trim()}
              className="btn-primary inline-flex items-center gap-2"
            >
              Start here
              <ArrowRight size={17} />
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <Disclosure />
        </div>
      </div>
    </div>
  );
};
