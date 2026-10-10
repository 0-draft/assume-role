import { useState, type ReactNode } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { useNarrow } from "@/hooks/useNarrow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Figure, Segmented } from "@/components/ui";
import { rich } from "@/lib/rich";
import {
  CALLERS,
  callerById,
  canDeactivateIn,
  route,
  type CallerId,
  type EndpointChoice,
  type Era,
  type Resolver,
  type TokenVersion,
} from "./model";

/** Four Regions, west to east, that tell the whole story. */
const STATIONS: { code: string; label: L; optIn: boolean }[] = [
  { code: "us-east-1", label: { en: "N. Virginia", ja: "バージニア北部" }, optIn: false },
  { code: "eu-north-1", label: { en: "Stockholm", ja: "ストックホルム" }, optIn: false },
  { code: "ap-east-1", label: { en: "Hong Kong", ja: "香港" }, optIn: true },
  { code: "ap-northeast-1", label: { en: "Tokyo", ja: "東京" }, optIn: false },
];

interface Geo {
  w: number;
  h: number;
  station: (i: number) => { x: number; y: number };
  caller: (i: number) => { x: number; y: number };
  path: (from: number, to: number) => string;
  boxW: number;
  boxH: number;
}

const WIDE: Geo = {
  w: 920,
  h: 270,
  boxW: 170,
  boxH: 64,
  station: (i) => ({ x: 115 + i * 230, y: 196 }),
  caller: (i) => ({ x: 115 + i * 230, y: 42 }),
  path: (from, to) => {
    const a = 115 + from * 230;
    const b = 115 + to * 230;
    return a === b ? `M${a},66 L${a},160` : `M${a},66 L${a},124 L${b},124 L${b},160`;
  },
};

const NARROW: Geo = {
  w: 360,
  h: 420,
  boxW: 150,
  boxH: 64,
  station: (i) => ({ x: 270, y: 54 + i * 102 }),
  caller: (i) => ({ x: 62, y: 54 + i * 102 }),
  path: (from, to) => {
    const a = 54 + from * 102;
    const b = 54 + to * 102;
    return a === b ? `M110,${a} L190,${a}` : `M110,${a} L150,${a} L150,${b} L190,${b}`;
  },
};

export function RouterSim() {
  const { t } = useLang();
  const narrow = useNarrow();
  const reduced = useReducedMotion();
  const [era, setEra] = useState<Era>("after");
  const [caller, setCaller] = useState<CallerId>("vpc-default");
  const [endpoint, setEndpoint] = useState<EndpointChoice>("global");
  const [resolver, setResolver] = useState<Resolver>("amazon");
  const [stsActive, setStsActive] = useState(true);
  const [tokenVersion, setTokenVersion] = useState<TokenVersion>("v1");

  const c = callerById(caller);
  const r = route({ caller, endpoint, resolver, stsActive, tokenVersion, era });
  const g = narrow ? NARROW : WIDE;
  const from = STATIONS.findIndex((s) => s.code === c.region);
  const to = STATIONS.findIndex((s) => s.code === r.servingRegion);
  const ct = STATIONS.findIndex((s) => s.code === r.cloudTrailRegion);
  const d = g.path(from, to);
  const color = r.error ? "var(--deny)" : "var(--sts)";
  const key = [era, caller, endpoint, resolver, stsActive, tokenVersion].join();
  const fs = narrow ? 13 : 15;

  const yes = { en: "Yes", ja: "はい" };
  const no = { en: "No", ja: "いいえ" };

  return (
    <Figure
      title={{
        en: "Where does my STS request actually go?",
        ja: "その STS リクエスト、実際どこに行く?",
      }}
      hint={{
        en: "Pick where the caller runs and which hostname it uses. The line shows which Region serves the request; the book marks where CloudTrail logs it.",
        ja: "呼び出し元の場所と使うホスト名を選んでください。線は処理するリージョン、本のマークは CloudTrail が記録するリージョンです。",
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Segmented
          label={{ en: "When", ja: "時期" }}
          value={era}
          onChange={setEra}
          options={[
            {
              value: "before",
              label: { en: "Before Apr 2025", ja: "2025 年 4 月より前" },
            },
            { value: "after", label: { en: "Since 2025-04-18", ja: "2025-04-18 以降" } },
          ]}
        />
        <Segmented
          label={{ en: "Hostname", ja: "ホスト名" }}
          value={endpoint}
          onChange={setEndpoint}
          options={[
            {
              value: "global",
              label: { en: "sts.amazonaws.com", ja: "sts.amazonaws.com" },
            },
            {
              value: "regional",
              label: {
                en: `sts.${c.region}.amazonaws.com`,
                ja: `sts.${c.region}.amazonaws.com`,
              },
            },
          ]}
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <Segmented
            label={{ en: "Caller", ja: "呼び出し元" }}
            value={caller}
            onChange={setCaller}
            color="var(--caller)"
            options={CALLERS.map((x) => ({ value: x.id, label: x.label }))}
          />
        </div>
        {c.inVpc && (
          <Segmented
            label={{ en: "Who resolves the name", ja: "名前解決するのは" }}
            value={resolver}
            onChange={setResolver}
            options={[
              {
                value: "amazon",
                label: { en: "Amazon DNS (VPC)", ja: "Amazon DNS (VPC)" },
              },
              {
                value: "other",
                label: { en: "Custom or public DNS", ja: "独自・公開 DNS" },
              },
            ]}
          />
        )}
        {endpoint === "regional" && canDeactivateIn(c) && (
          <Segmented
            label={{
              en: `STS in ${c.region} (issuing account)`,
              ja: `${c.region} の STS (発行側アカウント)`,
            }}
            value={stsActive ? "on" : "off"}
            onChange={(v) => setStsActive(v === "on")}
            color={stsActive ? "var(--sts)" : "var(--deny)"}
            options={[
              { value: "on", label: { en: "Active", ja: "有効" } },
              { value: "off", label: { en: "Deactivated", ja: "無効化" } },
            ]}
          />
        )}
        {endpoint === "global" && (
          <Segmented
            label={{
              en: "Global endpoint token version",
              ja: "グローバルのトークンバージョン",
            }}
            value={tokenVersion}
            onChange={setTokenVersion}
            options={[
              { value: "v1", label: { en: "v1 (default)", ja: "v1 (既定)" } },
              { value: "v2", label: { en: "v2 (all Regions)", ja: "v2 (全リージョン)" } },
            ]}
          />
        )}
      </div>

      <div className="mt-6">
        <svg
          viewBox={`0 0 ${g.w} ${g.h}`}
          className="mx-auto block w-full"
          style={{ maxWidth: narrow ? 420 : g.w }}
          role="img"
          aria-labelledby="router-desc"
        >
          <desc id="router-desc">
            {t({
              en: `Request from ${c.region} to ${r.hostname}, served in ${r.servingRegion}, logged in ${r.cloudTrailRegion ?? "nowhere"}.`,
              ja: `${c.region} から ${r.hostname} へのリクエスト。処理は ${r.servingRegion}、記録は ${r.cloudTrailRegion ?? "なし"}。`,
            })}
          </desc>
          {/* Rail between stations */}
          {!narrow && (
            <line
              x1={g.station(0).x}
              x2={g.station(STATIONS.length - 1).x}
              y1={g.station(0).y}
              y2={g.station(0).y}
              stroke="var(--line)"
              strokeWidth={6}
              strokeLinecap="round"
            />
          )}
          {STATIONS.map((s, i) => {
            const p = g.station(i);
            const serving = i === to;
            const accent = s.optIn ? "var(--caller)" : "var(--role)";
            return (
              <g key={s.code}>
                <rect
                  x={p.x - g.boxW / 2}
                  y={p.y - g.boxH / 2}
                  width={g.boxW}
                  height={g.boxH}
                  rx={12}
                  fill={
                    serving
                      ? `color-mix(in oklab, ${color} 16%, var(--surface))`
                      : "var(--surface)"
                  }
                  stroke={serving ? color : "var(--line)"}
                  strokeWidth={serving ? 3 : 1.5}
                />
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontWeight={600}
                  fontSize={fs}
                  fill="var(--ink)"
                >
                  {s.code}
                </text>
                <text
                  x={p.x}
                  y={p.y + 15}
                  textAnchor="middle"
                  fontSize={fs - 2}
                  fill={accent}
                >
                  {t(s.label)} {s.optIn ? t({ en: "(opt-in)", ja: "(オプトイン)" }) : ""}
                </text>
                {i === ct && (
                  <g
                    transform={`translate(${p.x + g.boxW / 2 - 16}, ${p.y - g.boxH / 2 - 12})`}
                  >
                    <rect width={24} height={20} rx={3} fill="var(--idp)" />
                    <path
                      d="M12 3v14M5 6h4M5 10h4M15 6h4M15 10h4"
                      stroke="var(--surface)"
                      strokeWidth={1.6}
                    />
                    <title>
                      {t({ en: "CloudTrail logs here", ja: "CloudTrail はここに記録" })}
                    </title>
                  </g>
                )}
              </g>
            );
          })}
          {/* Caller */}
          {(() => {
            const p = g.caller(from);
            return (
              <g>
                <circle cx={p.x} cy={p.y} r={22} fill="var(--caller)" />
                <path
                  d={
                    c.inVpc
                      ? `M${p.x - 9},${p.y - 7} h18 v14 h-18 Z M${p.x - 4},${p.y - 2} h8`
                      : `M${p.x - 11},${p.y + 6} h22 M${p.x - 8},${p.y + 4} v-11 h16 v11`
                  }
                  stroke="var(--on-color)"
                  strokeWidth={2}
                  fill="none"
                />
                <text
                  x={narrow ? p.x : p.x - 32}
                  y={narrow ? p.y + 40 : p.y + 5}
                  textAnchor={narrow ? "middle" : "end"}
                  fontSize={fs - 2}
                  fontWeight={600}
                  fill="var(--caller)"
                >
                  {c.inVpc
                    ? t({ en: "EC2 in a VPC", ja: "VPC 内の EC2" })
                    : t({ en: "Laptop", ja: "ノート PC" })}
                </text>
              </g>
            );
          })()}
          {/* Request path */}
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={3.5}
            strokeDasharray={r.error ? "8 6" : undefined}
            markerEnd="url(#router-arrow)"
          />
          <defs>
            <marker
              id="router-arrow"
              viewBox="0 0 10 10"
              refX={8}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={color} />
            </marker>
          </defs>
          {!reduced && (
            <circle key={key} r={7} fill={color}>
              <animateMotion dur="1.4s" repeatCount="indefinite" path={d} />
            </circle>
          )}
          {/* Resolver tag next to the caller; flips under the label at the east edge. */}
          {!narrow &&
            (() => {
              const p = g.caller(from);
              const edge = from === STATIONS.length - 1;
              return (
                <text
                  x={edge ? p.x - 32 : p.x + 30}
                  y={edge ? p.y + 24 : p.y + 6}
                  textAnchor={edge ? "end" : "start"}
                  fontSize={fs - 2}
                  fill="var(--muted)"
                >
                  {r.resolver === "amazon"
                    ? t({ en: "resolved by Amazon DNS", ja: "Amazon DNS で解決" })
                    : c.inVpc
                      ? t({ en: "resolved by custom DNS", ja: "独自 DNS で解決" })
                      : t({ en: "resolved by your ISP", ja: "ISP の DNS で解決" })}
                </text>
              );
            })()}
        </svg>
      </div>

      {r.error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border-2 border-[var(--deny)] bg-[color-mix(in_oklab,var(--deny)_8%,var(--surface))] px-4 py-3"
        >
          <div className="font-mono font-semibold text-[var(--deny)]">
            {r.error.code} (HTTP {r.error.http})
          </div>
          <p className="mt-1 text-sm">{t(r.error.message)}</p>
        </div>
      )}

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2" aria-live="polite">
        <Row label={{ en: "Hostname called", ja: "呼んだホスト名" }}>
          <code className="chip">{r.hostname}</code>
        </Row>
        <Row label={{ en: "Served in", ja: "処理リージョン" }}>
          <code className="chip">{r.servingRegion}</code>{" "}
          {r.servedLocally && (
            <span className="text-[var(--sts)]">
              {t({ en: "served locally", ja: "ローカルで処理" })}
            </span>
          )}
        </Row>
        <Row label={{ en: "CloudTrail event lands in", ja: "CloudTrail の記録先" }}>
          {r.cloudTrailRegion ? (
            <code className="chip">{r.cloudTrailRegion}</code>
          ) : (
            t({ en: "Nothing issued", ja: "発行されない" })
          )}
        </Row>
        <Row label={{ en: "aws:RequestedRegion", ja: "aws:RequestedRegion" }}>
          <code className="chip">{r.requestedRegion}</code>
        </Row>
        <Row
          label={{
            en: "additionalEventData.RequestDetails",
            ja: "additionalEventData.RequestDetails",
          }}
        >
          {r.requestDetails ? (
            <code className="block rounded-md border border-[var(--line)] bg-[var(--sunk)] px-1.5 py-0.5 font-mono text-[0.8rem] break-all">
              {`{"endpointType": "${r.requestDetails.endpointType}", "awsServingRegion": "${r.requestDetails.awsServingRegion}"}`}
            </code>
          ) : (
            <span className="text-[var(--muted)]">
              {t({
                en: "Not present (fields arrived with the April 2025 change)",
                ja: "なし (2025 年 4 月の変更で追加されたフィールドです)",
              })}
            </span>
          )}
        </Row>
        <Row
          label={{
            en: "Token works in opt-in Regions",
            ja: "トークンがオプトインリージョンで使えるか",
          }}
        >
          <span
            style={{ color: r.tokenWorksInOptIn ? "var(--resource)" : "var(--deny)" }}
            className="font-semibold"
          >
            {t(r.tokenWorksInOptIn ? yes : no)}
          </span>
        </Row>
        <Row label={{ en: "Throttling bucket", ja: "スロットリングの枠" }} wide>
          {t(r.quota)}
        </Row>
      </dl>

      {r.warnings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {r.warnings.map((w, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span
                aria-hidden
                className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--deny)]"
              />
              <span>{rich(t(w))}</span>
            </li>
          ))}
        </ul>
      )}
    </Figure>
  );
}

function Row({
  label,
  children,
  wide = false,
}: {
  label: L;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useLang();
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="text-xs font-semibold text-[var(--muted)]">{t(label)}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
