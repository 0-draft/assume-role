/** Actor hues used by every diagram on the site. */
export type Actor = "caller" | "sts" | "idp" | "role" | "resource" | "deny";

export const actorVar = (a: Actor) => `var(--${a})`;
