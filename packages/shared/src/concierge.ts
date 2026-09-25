/**
 * The concierge: a member of staff on the street who answers the questions a
 * first-time visitor actually asks.
 *
 * Scripted on purpose, not a language model. A showroom assistant that
 * improvises can promise a delivery date nobody agreed to; one that answers
 * from a fixed list cannot. So this is a graph of topics, and the only thing a
 * visitor can do is pick one.
 *
 * Text lives in the dictionaries rather than here: a topic carries the keys,
 * which keeps the graph one shape in both languages and lets a test prove that
 * neither language is missing a line. The keys are flat inside the `concierge`
 * section because that is what the Dictionary type allows — one level of
 * sections, strings underneath.
 */

export interface ConciergeTopic {
  id: string;
  /** Key of the question as a visitor would put it — this is the button. */
  question: string;
  /** Key of the answer. */
  answer: string;
  /** Topics offered after the answer, by id. */
  next: readonly string[];
  /**
   * Somewhere in the application the answer points at. Rendered as a link, so
   * "where are my orders" ends at the orders page rather than at a description
   * of where the orders page is.
   */
  link?: { to: string; label: string };
}

/** The questions offered before a visitor has asked anything. */
export const CONCIERGE_OPENING = ['find', 'walk', 'missions', 'buy', 'supplier'] as const;

export const CONCIERGE_TOPICS: readonly ConciergeTopic[] = [
  {
    id: 'find',
    question: 'concierge.findQuestion',
    answer: 'concierge.findAnswer',
    next: ['catalog', 'pavilions', 'buy'],
  },
  {
    id: 'catalog',
    question: 'concierge.catalogQuestion',
    answer: 'concierge.catalogAnswer',
    next: ['find', 'buy'],
    link: { to: '/catalog', label: 'concierge.catalogLink' },
  },
  {
    id: 'pavilions',
    question: 'concierge.pavilionsQuestion',
    answer: 'concierge.pavilionsAnswer',
    next: ['find', 'supplier'],
  },
  {
    id: 'walk',
    question: 'concierge.walkQuestion',
    answer: 'concierge.walkAnswer',
    next: ['find', 'missions'],
  },
  {
    id: 'missions',
    question: 'concierge.missionsQuestion',
    answer: 'concierge.missionsAnswer',
    next: ['reward', 'buy'],
  },
  {
    id: 'reward',
    question: 'concierge.rewardQuestion',
    answer: 'concierge.rewardAnswer',
    next: ['missions', 'buy'],
  },
  {
    id: 'buy',
    question: 'concierge.buyQuestion',
    answer: 'concierge.buyAnswer',
    next: ['delivery', 'payment', 'orders'],
    link: { to: '/cart', label: 'concierge.buyLink' },
  },
  {
    id: 'payment',
    question: 'concierge.paymentQuestion',
    answer: 'concierge.paymentAnswer',
    next: ['buy', 'delivery'],
  },
  {
    id: 'delivery',
    question: 'concierge.deliveryQuestion',
    answer: 'concierge.deliveryAnswer',
    next: ['orders', 'buy'],
  },
  {
    id: 'orders',
    question: 'concierge.ordersQuestion',
    answer: 'concierge.ordersAnswer',
    next: ['delivery', 'find'],
    link: { to: '/orders', label: 'concierge.ordersLink' },
  },
  {
    id: 'supplier',
    question: 'concierge.supplierQuestion',
    answer: 'concierge.supplierAnswer',
    next: ['upload', 'pavilions'],
    link: { to: '/register', label: 'concierge.supplierLink' },
  },
  {
    id: 'upload',
    question: 'concierge.uploadQuestion',
    answer: 'concierge.uploadAnswer',
    next: ['supplier', 'moderation'],
  },
  {
    id: 'moderation',
    question: 'concierge.moderationQuestion',
    answer: 'concierge.moderationAnswer',
    next: ['upload', 'pavilions'],
  },
];

const BY_ID = new Map(CONCIERGE_TOPICS.map((topic) => [topic.id, topic]));

export function conciergeTopic(id: string): ConciergeTopic | null {
  return BY_ID.get(id) ?? null;
}

/**
 * The topics to offer next, resolved and deduplicated.
 *
 * An unknown id is dropped rather than thrown: a dialogue that ends in a blank
 * screen is worse than one that offers a shorter list.
 */
export function conciergeFollowUps(id: string): ConciergeTopic[] {
  const topic = conciergeTopic(id);
  if (!topic) return conciergeOpening();

  const seen = new Set<string>([id]);
  const followUps: ConciergeTopic[] = [];

  for (const nextId of topic.next) {
    if (seen.has(nextId)) continue;
    const next = conciergeTopic(nextId);
    if (!next) continue;
    seen.add(nextId);
    followUps.push(next);
  }

  return followUps;
}

export function conciergeOpening(): ConciergeTopic[] {
  return CONCIERGE_OPENING.map((id) => conciergeTopic(id)).filter(
    (topic): topic is ConciergeTopic => topic !== null,
  );
}
