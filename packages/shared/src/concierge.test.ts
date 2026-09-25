import { describe, expect, it } from 'vitest';
import {
  CONCIERGE_OPENING,
  CONCIERGE_TOPICS,
  conciergeFollowUps,
  conciergeOpening,
  conciergeTopic,
} from './concierge.js';
import { en, ru } from './i18n/index.js';

/**
 * A scripted dialogue fails in two ways, and both are silent in a browser: a
 * button that leads nowhere, and a line nobody translated. Both are caught here
 * rather than by a visitor.
 */
describe('the concierge dialogue graph', () => {
  it('has unique ids', () => {
    const ids = CONCIERGE_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers only topics that exist', () => {
    for (const topic of CONCIERGE_TOPICS) {
      for (const next of topic.next) {
        expect(conciergeTopic(next), `${topic.id} → ${next}`).not.toBeNull();
      }
    }
  });

  it('opens with topics that exist', () => {
    expect(conciergeOpening()).toHaveLength(CONCIERGE_OPENING.length);
  });

  it('leaves no topic unreachable', () => {
    const reached = new Set<string>(CONCIERGE_OPENING);
    const queue = [...CONCIERGE_OPENING] as string[];

    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) break;
      for (const next of conciergeTopic(id)?.next ?? []) {
        if (reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }

    const orphans = CONCIERGE_TOPICS.filter((topic) => !reached.has(topic.id)).map(
      (topic) => topic.id,
    );
    expect(orphans).toEqual([]);
  });

  it('never offers the topic being read as its own follow-up', () => {
    for (const topic of CONCIERGE_TOPICS) {
      expect(conciergeFollowUps(topic.id).map((next) => next.id)).not.toContain(topic.id);
    }
  });

  it('always leads somewhere: every topic has at least one way on', () => {
    for (const topic of CONCIERGE_TOPICS) {
      expect(conciergeFollowUps(topic.id).length, topic.id).toBeGreaterThan(0);
    }
  });

  it('falls back to the opening when asked about a topic that does not exist', () => {
    expect(conciergeFollowUps('no-such-topic').map((topic) => topic.id)).toEqual([
      ...CONCIERGE_OPENING,
    ]);
  });

  it('is translated in both languages, question, answer and link alike', () => {
    const keys = CONCIERGE_TOPICS.flatMap((topic) => [
      topic.question,
      topic.answer,
      ...(topic.link ? [topic.link.label] : []),
    ]);

    for (const dictionary of [ru, en]) {
      const section: Record<string, string> = dictionary.concierge;

      for (const key of keys) {
        const leaf = key.slice('concierge.'.length);
        expect(section[leaf], `${key}`).toBeTruthy();
      }
    }
  });

  it('keeps the two dictionaries the same shape', () => {
    expect(Object.keys(ru.concierge).sort()).toEqual(Object.keys(en.concierge).sort());
  });
});
