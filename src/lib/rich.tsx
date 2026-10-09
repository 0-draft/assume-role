import type { ReactNode } from "react";

/**
 * Minimal inline markup for copy that lives in data files:
 * `code` becomes a chip, **bold** becomes strong.
 */
export function rich(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`"))
      out.push(
        <code key={k++} className="chip">
          {tok.slice(1, -1)}
        </code>,
      );
    else out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
