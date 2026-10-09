import type { L } from "@/i18n/lang";

/** Lifetimes compared in the leak-window figure. null = never expires. */
export const LIFETIMES: { id: string; label: L; hours: number | null }[] = [
  {
    id: "akia",
    label: { en: "Long-term key (AKIA)", ja: "長期キー (AKIA)" },
    hours: null,
  },
  {
    id: "gst",
    label: { en: "GetSessionToken, max", ja: "GetSessionToken 最大" },
    hours: 36,
  },
  {
    id: "role12",
    label: { en: "AssumeRole, 12 h role", ja: "AssumeRole 12 時間ロール" },
    hours: 12,
  },
  { id: "role1", label: { en: "AssumeRole, default", ja: "AssumeRole 既定" }, hours: 1 },
  { id: "root", label: { en: "AssumeRoot", ja: "AssumeRoot" }, hours: 0.25 },
];

/**
 * Hours a leaked key stays usable, assuming it leaks the moment it is issued:
 * until it expires or until someone revokes it, whichever comes first.
 */
export function exposureHours(lifetime: number | null, noticedAfter: number): number {
  if (lifetime === null) return noticedAfter;
  return Math.min(lifetime, noticedAfter);
}
