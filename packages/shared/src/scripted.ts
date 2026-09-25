/**
 * Matching what somebody said to something we have an answer for.
 *
 * Shared by the people in the world and by the guide, because the problem is
 * the same in both places: a written answer exists, and the question arrived
 * as free text — typed, or transcribed by a browser that heard it.
 *
 * Deliberately dumb. The alternative is a language model that can invent a
 * refund policy, and answering the wrong scripted question is a much smaller
 * problem than answering an unscripted one.
 */

export interface ScriptedText {
  ru: string;
  en: string;
}

export interface ScriptedLine {
  id: string;
  /** What is being asked, as a button and as something somebody can say. */
  question: ScriptedText;
  answer: ScriptedText;
  /**
   * Words that mean this question. Kept short and lower case; matching is by
   * whole word, so "цена" does not fire on "оценка".
   */
  heard: readonly string[];
}

/**
 * Whether a word means a keyword.
 *
 * Russian inflects, and it inflects inside the word's tail rather than after
 * it: somebody asking "а что с доставкой" says a word that does not begin with
 * "доставка" — the eighth letter already differs. So the comparison is on
 * stems, dropping the last two characters of the shorter word, which catches
 * доставка/доставкой and гарантия/гарантией.
 *
 * Words shorter than five characters must match exactly. Three letters of stem
 * is not evidence, and it is what keeps "цена" from firing on "оценка".
 */
function meansTheSame(word: string, keyword: string): boolean {
  const shortest = Math.min(word.length, keyword.length);
  if (shortest < 5) return word === keyword;

  const stem = shortest - 2;
  return word.slice(0, stem) === keyword.slice(0, stem);
}

/**
 * Picks the line a piece of text is asking for, or nothing.
 *
 * Scored by the length of the keywords that hit rather than by how many:
 * "what about delivery" contains both a generic "what" and a specific
 * "delivery", and the specific one is what the question is about.
 */
export function matchHeard<Line extends ScriptedLine>(
  text: string,
  lines: readonly Line[],
): Line | null {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return null;

  let best: Line | null = null;
  let bestScore = 0;

  for (const line of lines) {
    let score = 0;

    for (const word of words) {
      for (const keyword of line.heard) {
        if (meansTheSame(word, keyword)) {
          score += keyword.length;
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }

  return best;
}
