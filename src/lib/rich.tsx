import type { ReactNode } from "react";

/** Inline code this short never breaks across lines; longer ARNs and URLs may. */
const NOWRAP_MAX = 24;

/**
 * Minimal inline markup for copy that lives in data files:
 * `code` becomes a chip, **bold** becomes strong (and may contain `code`).
 */
export function rich(s: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*.+?\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}${k++}`;
    if (tok.startsWith("`")) {
      const body = tok.slice(1, -1);
      out.push(
        <code
          key={key}
          className={body.length <= NOWRAP_MAX ? "chip whitespace-nowrap" : "chip"}
        >
          {body}
        </code>,
      );
    } else {
      const body = tok.slice(2, -2);
      // A short bold token with no spaces (a date, a Region) stays on one line.
      const nowrap = !/\s/.test(body) && body.length <= NOWRAP_MAX;
      out.push(
        <strong key={key} className={nowrap ? "whitespace-nowrap" : undefined}>
          {rich(body, `${key}-`)}
        </strong>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/**
 * Break opportunities for long identifiers: before each capital in
 * camel-case API names and after dots and slashes in hostnames and ARNs.
 */
export function softBreaks(id: string): ReactNode[] {
  const parts = id.split(/(?<=[a-z])(?=[A-Z])|(?<=[./:])/);
  return parts.flatMap((p, i) => (i === 0 ? [p] : [<wbr key={i} />, p]));
}
