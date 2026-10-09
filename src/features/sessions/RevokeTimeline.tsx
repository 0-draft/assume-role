import { useState } from "react";
import { useLang } from "@/i18n/useLang";
import { Code } from "@/components/ui";
import {
  REVOKE_LEAD_MINUTES,
  isoAt,
  revokePolicy,
  sessionState,
  type SessionState,
  type SessionStub,
} from "./model";

const AXIS_MIN = -75;
const AXIS_MAX = 25;
const MAX_NEW = 4;

const INITIAL: SessionStub[] = [
  { id: "ci-run-40", issuedAt: -72, duration: 60 },
  { id: "alice-laptop", issuedAt: -48, duration: 60 },
  { id: "batch-nightly", issuedAt: -26, duration: 120 },
  { id: "ci-run-41", issuedAt: -6, duration: 60 },
];

const x = (m: number) =>
  `${((Math.max(AXIS_MIN, Math.min(AXIS_MAX, m)) - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 100}%`;

const STATE_STYLE: Record<SessionState, { color: string; fill: string }> = {
  active: { color: "var(--resource)", fill: "var(--resource)" },
  expired: { color: "var(--muted)", fill: "var(--line)" },
  revoked: {
    color: "var(--deny)",
    fill: "repeating-linear-gradient(135deg, var(--deny) 0 5px, color-mix(in oklab, var(--deny) 45%, transparent) 5px 10px)",
  },
};

const hhmm = (m: number) => isoAt(m).slice(11, 16);

export function RevokeTimeline() {
  const { t } = useLang();
  const [now, setNow] = useState(0);
  const [sessions, setSessions] = useState(INITIAL);
  const [revokeBefore, setRevokeBefore] = useState<number | null>(null);
  const added = sessions.length - INITIAL.length;

  const stateLabel: Record<SessionState, string> = {
    active: t({ en: "works", ja: "使える" }),
    expired: t({ en: "expired", ja: "期限切れ" }),
    revoked: t({ en: "denied", ja: "拒否" }),
  };

  const issue = () => {
    if (added >= MAX_NEW) return;
    const at = now + 2;
    setNow(at);
    setSessions((s) => [
      ...s,
      { id: `ci-run-${42 + added}`, issuedAt: at, duration: 60 },
    ]);
  };

  const ticks = [-60, -45, -30, -15, 0, 15];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRevokeBefore(now + REVOKE_LEAD_MINUTES)}
          className="min-h-10 rounded-lg bg-[var(--deny)] px-3 text-sm font-bold text-[var(--on-color)]"
        >
          {revokeBefore === null
            ? t({ en: "Revoke active sessions", ja: "アクティブなセッションを取り消す" })
            : t({
                en: "Revoke again (moves the line)",
                ja: "もう一度取り消す (線が動く)",
              })}
        </button>
        <button
          type="button"
          aria-disabled={added >= MAX_NEW}
          onClick={issue}
          className="min-h-10 rounded-lg bg-[var(--sts)] px-3 text-sm font-bold text-[var(--on-color)] aria-disabled:opacity-40"
        >
          {t({
            en: "Two minutes pass, a new session is issued",
            ja: "2 分後に新しいセッションを発行",
          })}
        </button>
        <button
          type="button"
          onClick={() => {
            setNow(0);
            setSessions(INITIAL);
            setRevokeBefore(null);
          }}
          className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold"
        >
          {t({ en: "Reset", ja: "リセット" })}
        </button>
      </div>

      <div tabIndex={0} className="scroll-x">
        <div className="min-w-[560px]">
          <div
            className="relative mr-[4.5rem] ml-28 h-6 text-[0.68rem] text-[var(--muted)]"
            aria-hidden
          >
            {ticks.map((m) => (
              <span
                key={m}
                className="absolute -translate-x-1/2 font-mono"
                style={{ left: x(m) }}
              >
                {hhmm(m)}
              </span>
            ))}
          </div>
          <div className="relative">
            <ul className="space-y-2">
              {sessions.map((s) => {
                const st = sessionState(s, now, revokeBefore);
                const style = STATE_STYLE[st];
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="w-26 shrink-0 truncate font-mono text-xs">
                      {s.id}
                    </span>
                    <div className="relative h-7 flex-1 rounded-md bg-[var(--sunk)]">
                      <div
                        className="absolute top-1 bottom-1 rounded transition-[background]"
                        style={{
                          left: x(s.issuedAt),
                          width: `calc(${x(s.issuedAt + s.duration)} - ${x(s.issuedAt)})`,
                          background: style.fill,
                          opacity: st === "active" ? 0.85 : 1,
                        }}
                      />
                      <span
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)]"
                        style={{ left: x(s.issuedAt), background: "var(--ink)" }}
                        title={`aws:TokenIssueTime ${isoAt(s.issuedAt)}`}
                      />
                    </div>
                    <span
                      className="w-16 shrink-0 text-right text-xs font-bold"
                      style={{ color: style.color }}
                    >
                      {stateLabel[st]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-[var(--ink)]"
              style={{
                left: `calc(7rem + (100% - 7rem - 4.5rem) * ${(now - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)})`,
              }}
            >
              <span className="absolute -top-5 -translate-x-1/2 rounded bg-[var(--ink)] px-1 text-[0.62rem] font-bold text-[var(--paper)]">
                {t({ en: "now", ja: "現在" })}
              </span>
            </div>
            {revokeBefore !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-[var(--deny)]"
                style={{
                  left: `calc(7rem + (100% - 7rem - 4.5rem) * ${(revokeBefore - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)})`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="prose-col text-sm">
        {revokeBefore === null
          ? t({
              en: "Each dot is a session's aws:TokenIssueTime. Nothing has been revoked yet, so every unexpired session works.",
              ja: "点は各セッションの aws:TokenIssueTime です。まだ何も取り消していないので、期限内のセッションはすべて使えます。",
            })
          : t({
              en: `Every request from a session issued before ${isoAt(revokeBefore)} is now denied. Sessions issued after the line keep working, which is why someone who can still assume the role just gets a fresh pass.`,
              ja: `${isoAt(revokeBefore)} より前に発行されたセッションからのリクエストは、すべて拒否されます。線より後に発行されたセッションは使えるので、ロールを引き受けられる人は新しい通行証を取り直すだけで済んでしまいます。`,
            })}
      </p>
      {revokeBefore !== null && (
        <Code
          label={t({
            en: "Inline policy AWSRevokeOlderSessions, added to the role",
            ja: "ロールに追加されるインラインポリシー AWSRevokeOlderSessions",
          })}
        >
          {revokePolicy(revokeBefore)}
        </Code>
      )}
    </div>
  );
}
