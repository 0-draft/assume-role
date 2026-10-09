import { useId, useState } from "react";
import type { L } from "@/i18n/lang";
import { useLang } from "@/i18n/useLang";
import { Figure, Segmented } from "@/components/ui";
import { rich } from "@/lib/rich";
import { buildHostname, FAMILIES, type Family, type SegmentKind } from "./hostname";
import { partitionById, PARTITIONS, regionByCode, type PartitionId } from "./regions";

const KIND_COLOR: Record<SegmentKind, string> = {
  service: "var(--sts)",
  variant: "var(--idp)",
  region: "var(--caller)",
  suffix: "var(--role)",
};

const FAMILY_LABEL: Record<Family, L> = {
  global: { en: "Global", ja: "グローバル" },
  regional: { en: "Regional", ja: "リージョナル" },
  fips: { en: "FIPS", ja: "FIPS" },
  dualstack: { en: "Dual-stack (IPv6)", ja: "デュアルスタック (IPv6)" },
  "fips-dualstack": { en: "FIPS + dual-stack", ja: "FIPS + デュアルスタック" },
  vpce: { en: "VPC endpoint (private DNS)", ja: "VPC エンドポイント (プライベート DNS)" },
};

export function HostnameBuilder() {
  const { t } = useLang();
  const selectId = useId();
  const [partition, setPartition] = useState<PartitionId>("aws");
  const [region, setRegion] = useState("ap-northeast-1");
  const [family, setFamily] = useState<Family>("regional");
  const p = partitionById(partition);

  const pickPartition = (id: PartitionId) => {
    setPartition(id);
    setRegion(partitionById(id).regions[0]);
  };

  const r = buildHostname(partition, region, family);

  return (
    <Figure
      title={{ en: "Anatomy of an STS hostname", ja: "STS ホスト名の解剖" }}
      hint={{
        en: "Every STS hostname is the same four parts. Change one and see whether the window you asked for exists.",
        ja: "STS のホスト名は同じ部品の組み合わせです。部品を変えて、その窓口が本当にあるか確かめてください。",
      }}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <Segmented
          label={{ en: "Partition", ja: "パーティション" }}
          value={partition}
          onChange={pickPartition}
          color="var(--role)"
          options={PARTITIONS.map((x) => ({ value: x.id, label: x.name }))}
        />
        <div>
          <label
            htmlFor={selectId}
            className="mb-2 block text-sm font-semibold text-[var(--muted)]"
          >
            {t({ en: "Region", ja: "リージョン" })}
          </label>
          <select
            id={selectId}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="min-h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-sm"
          >
            {p.regions.map((code) => {
              const reg = regionByCode(code);
              return (
                <option key={code} value={code}>
                  {code}
                  {reg ? ` (${t(reg.name)})` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <div className="mt-4">
        <Segmented
          label={{ en: "Endpoint family", ja: "エンドポイントの種類" }}
          value={family}
          onChange={setFamily}
          options={FAMILIES.map((f) => ({ value: f, label: FAMILY_LABEL[f] }))}
        />
      </div>

      <div
        className="guilloche mt-6 rounded-2xl border border-[var(--line)] px-4 py-6 sm:px-8"
        aria-live="polite"
      >
        {r.kind === "ok" ? (
          <>
            <div className="flex flex-wrap items-start justify-center gap-y-4 font-mono text-[clamp(1.15rem,4.4vw,2.2rem)] font-semibold">
              <span className="text-[var(--muted)]">https://</span>
              {r.segments.map((s, i) => (
                <span key={i} className="flex items-start">
                  {i > 0 && <span className="text-[var(--muted)]">.</span>}
                  <span className="flex flex-col items-center">
                    <span
                      className="rounded-md px-1"
                      style={{
                        color: KIND_COLOR[s.kind],
                        background: `color-mix(in oklab, ${KIND_COLOR[s.kind]} 12%, transparent)`,
                      }}
                    >
                      {s.text}
                    </span>
                    <span
                      className="mt-1.5 max-w-36 border-t-2 pt-1 text-center font-sans text-[0.72rem] leading-snug font-medium text-[var(--muted)]"
                      style={{ borderColor: KIND_COLOR[s.kind] }}
                    >
                      {t(s.note)}
                    </span>
                  </span>
                </span>
              ))}
            </div>
            <ul className="mx-auto mt-6 max-w-2xl space-y-1.5 text-sm">
              {r.notes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--sts)]"
                  />
                  <span>{rich(t(n))}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="text-center">
            <div
              className="stamp-in mx-auto inline-block rounded-lg border-4 px-4 py-1 font-display text-2xl font-bold"
              style={{
                color: r.kind === "none" ? "var(--deny)" : "var(--muted)",
                borderColor: r.kind === "none" ? "var(--deny)" : "var(--muted)",
              }}
              key={`${partition}${region}${family}`}
            >
              {r.kind === "none"
                ? t({ en: "No such window", ja: "その窓口はありません" })
                : t({ en: "Not documented", ja: "文書化されていません" })}
            </div>
            <p className="mx-auto mt-4 max-w-xl text-sm">{t(r.reason)}</p>
            {r.sdkWouldBuild && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {t({
                  en: "The SDK would still try:",
                  ja: "それでも SDK が組み立てる名前:",
                })}{" "}
                <code className="chip line-through decoration-[var(--deny)] decoration-2">
                  {r.sdkWouldBuild}
                </code>
              </p>
            )}
          </div>
        )}
      </div>
    </Figure>
  );
}
