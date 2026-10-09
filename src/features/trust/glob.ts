/**
 * IAM `StringLike` matching: `*` matches any run of characters (including
 * none), `?` matches exactly one character, everything else is literal and
 * case-sensitive. The whole value must match, not a substring.
 */
export function stringLike(pattern: string, value: string): boolean {
  // Iterative matcher with single-star backtracking: linear in practice and
  // immune to the catastrophic cases a naive regex can hit.
  let p = 0;
  let v = 0;
  let star = -1;
  let mark = 0;
  while (v < value.length) {
    if (p < pattern.length && (pattern[p] === "?" || pattern[p] === value[v])) {
      p++;
      v++;
    } else if (p < pattern.length && pattern[p] === "*") {
      star = p++;
      mark = v;
    } else if (star !== -1) {
      p = star + 1;
      v = ++mark;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === "*") p++;
  return p === pattern.length;
}

/** IAM rejects a GitHub trust policy whose sub value is only wildcards or empty. */
export function isOnlyWildcards(pattern: string): boolean {
  return /^[*?]*$/.test(pattern);
}
