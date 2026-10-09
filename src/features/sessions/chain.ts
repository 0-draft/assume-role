import type { Hop } from "./model";

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export const ROLES = [
  { role: "RoleB", roleTags: [{ key: "Team", value: "platform" }] },
  { role: "RoleC", roleTags: [{ key: "Env", value: "prod" }] },
  { role: "RoleD", roleTags: [{ key: "Team", value: "data" }] },
  { role: "RoleE", roleTags: [] },
];

export const DURATIONS = [900, 3600, 7200, 14400, 43200];
export const ROLE_MAX = [3600, 14400, 43200];

/** What the reader can change on each hop. */
export interface HopUi {
  maxSessionDuration: number;
  requested: number;
  /** First hop: pass Project=apollo as a transitive tag. Later hops: try to re-pass it. */
  project: boolean;
  /** First hop only: pass CostCenter=42 as a non-transitive tag. */
  costCenter: boolean;
  /** First hop: alice@example.com. Later hops: try bob@example.com. */
  sourceIdentity: boolean;
}

export const firstHop: HopUi = {
  maxSessionDuration: 43200,
  requested: 3600,
  project: true,
  costCenter: true,
  sourceIdentity: true,
};
export const laterHop: HopUi = {
  maxSessionDuration: 43200,
  requested: 3600,
  project: false,
  costCenter: false,
  sourceIdentity: false,
};

export function toHops(ui: HopUi[]): Hop[] {
  return ui.map((h, i) => ({
    role: ROLES[i].role,
    roleTags: ROLES[i].roleTags,
    maxSessionDuration: h.maxSessionDuration,
    requested: h.requested,
    sessionTags:
      i === 0
        ? [
            ...(h.project ? [{ key: "Project", value: "apollo", transitive: true }] : []),
            ...(h.costCenter
              ? [{ key: "CostCenter", value: "42", transitive: false }]
              : []),
          ]
        : h.project
          ? [{ key: "Project", value: "zeus", transitive: false }]
          : [],
    sourceIdentity: h.sourceIdentity
      ? i === 0
        ? "alice@example.com"
        : "bob@example.com"
      : undefined,
  }));
}
