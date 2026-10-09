import { ERRORS, type StsError } from "./data";

/**
 * Identify which documented error a pasted message is. The first pattern of
 * each entry is its error code, so an exact code wins over a looser phrase
 * match from another entry (for example "AccessDenied" appearing inside a
 * longer message about something else is a weak signal).
 */
export function matchError(input: string, errors: StsError[] = ERRORS): StsError[] {
  const text = input.trim();
  if (!text) return [];
  const scored: { e: StsError; score: number; order: number }[] = [];
  errors.forEach((e, order) => {
    let score = 0;
    e.patterns.forEach((re, i) => {
      if (re.test(text)) score += i === 0 ? 3 : 2;
    });
    if (text.toLowerCase().includes(e.code.toLowerCase())) score += 1;
    if (score > 0) scored.push({ e, score, order });
  });
  // The generic AccessDenied pattern is a fallback: drop it if anything more
  // specific matched the same text.
  const specific = scored.filter((s) => s.e.id !== "access-denied");
  const pool =
    specific.length && !/not authorized to perform:?\s*sts:/i.test(text)
      ? specific
      : scored;
  return pool.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.e);
}
