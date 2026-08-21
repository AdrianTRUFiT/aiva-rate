/**
 * Safety routing.
 *
 * This system deliberately meets people at the worst moment of their week. A
 * fraction of them will be in genuine crisis, and for those people the correct
 * product behaviour is to stop being a product: no intervention, no checkpoint,
 * no offer, no follow-up sequence — a human-staffed resource instead.
 *
 * The classifier is intentionally over-sensitive. A false positive costs one
 * person a slightly jarring screen. A false negative runs a breathing exercise
 * and a sales prompt at somebody who said they wanted to die.
 */

export type SafetyLevel = 'none' | 'route';

export type SafetyCategory =
  | 'self-harm'
  | 'harm-to-others'
  | 'abuse'
  | 'medical-emergency'
  | 'acute-substance';

export interface SafetySignal {
  level: SafetyLevel;
  categories: SafetyCategory[];
  matched: string[];
}

export interface SupportResource {
  name: string;
  contact: string;
  detail: string;
  region: string;
}

const PATTERNS: Record<SafetyCategory, RegExp[]> = {
  'self-harm': [
    /\bkill(ing)? myself\b/i,
    /\bend (my|it all|my life)\b/i,
    /\bsuicid(e|al)\b/i,
    /\btake my (own )?life\b/i,
    /\b(want|going|plan) to die\b/i,
    /\bbetter off (dead|without me)\b/i,
    /\bdon'?t want to (be here|live|wake up)\b/i,
    /\bno reason to (live|go on|keep going)\b/i,
    /\b(hurt|harm|cut)(t?ing)?\s+(myself|my ?self)\b/i,
    /\bself[- ]harm/i,
    /\boverdos(e|ing)\b/i,
  ],
  'harm-to-others': [
    /\bkill (him|her|them|someone|everyone)\b/i,
    /\bhurt (him|her|them|someone)\b/i,
    /\bmake them pay\b/i,
  ],
  abuse: [
    /\b(he|she|they|my (partner|husband|wife|boyfriend|girlfriend|father|mother|parents?))\s+(hits?|hit|beats?|beat|chokes?|threatens?|threatened)\s+me\b/i,
    /\bafraid (of|for) my (life|safety)\b/i,
    /\bnot safe at home\b/i,
    /\bdomestic (violence|abuse)\b/i,
    /\bbeing (abused|assaulted|stalked)\b/i,
  ],
  'medical-emergency': [
    /\b(chest pain|can'?t breathe|cannot breathe)\b/i,
    /\bpassed out\b/i,
    /\bbleeding (badly|heavily)\b/i,
  ],
  'acute-substance': [
    /\b(took|taken) (too many|a bottle of)\b/i,
    /\brelapsed? (badly|hard)\b/i,
    /\bdrinking to (cope|forget|numb)\b/i,
  ],
};

/**
 * Screens a person's own words for signals that should route them out of the
 * funnel. Returns every category that fired, because the resource shown differs
 * by category.
 */
export function screen(statement: string): SafetySignal {
  const text = statement.replace(/[‘’]/g, "'");
  const categories: SafetyCategory[] = [];
  const matched: string[] = [];

  (Object.keys(PATTERNS) as SafetyCategory[]).forEach((category) => {
    PATTERNS[category].forEach((pattern) => {
      const hit = text.match(pattern);
      if (hit) {
        if (!categories.includes(category)) categories.push(category);
        matched.push(hit[0]);
      }
    });
  });

  return {
    level: categories.length > 0 ? 'route' : 'none',
    categories,
    matched,
  };
}

/**
 * NOTE FOR LAUNCH: this list is US/UK-weighted and must be localised per market
 * before this system is pointed at a real audience. Verify every number on the
 * operator's own schedule — helplines change.
 */
export const SUPPORT_RESOURCES: SupportResource[] = [
  {
    name: 'Emergency services',
    contact: '911 (US) · 999 (UK) · 112 (EU)',
    detail: 'If you are in immediate physical danger, this is the right call to make first.',
    region: 'Local',
  },
  {
    name: '988 Suicide & Crisis Lifeline',
    contact: 'Call or text 988',
    detail: 'Free, confidential, 24/7. You do not have to be suicidal to call.',
    region: 'US',
  },
  {
    name: 'Crisis Text Line',
    contact: 'Text HOME to 741741',
    detail: 'Text with a trained volunteer crisis counsellor, 24/7.',
    region: 'US / CA',
  },
  {
    name: 'Find A Helpline',
    contact: 'findahelpline.com',
    detail: 'Free helplines in over 130 countries, searchable by location and topic.',
    region: 'International',
  },
];

export function resourcesFor(signal: SafetySignal): SupportResource[] {
  if (signal.categories.includes('medical-emergency')) {
    return SUPPORT_RESOURCES.filter((r) => r.region === 'Local' || r.region === 'International');
  }
  return SUPPORT_RESOURCES;
}

/**
 * What the system says when it routes. Written to be short, non-clinical, and
 * free of any implication that the person did something wrong by saying it.
 */
export const ROUTING_MESSAGE = {
  heading: 'This is bigger than a breathing exercise.',
  body:
    "Thank you for saying that plainly. What you described needs a person, not an automated guide — and there are people whose whole job is exactly this conversation, available right now.",
  close:
    'Nothing here is being sold to you and nothing further will be sent. If you come back later, this will still be here.',
} as const;
