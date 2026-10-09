import type { ReactNode } from "react";
import { useLang } from "@/i18n/useLang";
import type { Op } from "./ops";

function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-md border px-1.5 py-px text-[0.7rem] leading-5 font-semibold whitespace-nowrap"
      style={{ borderColor: color, color }}
    >
      {children}
    </span>
  );
}

/** Auth style, endpoint restriction and novelty of an operation. */
export function OpBadges({ op }: { op: Op }) {
  const { t } = useLang();
  return (
    <span className="flex flex-wrap gap-1">
      {op.auth === "sigv4" ? (
        <Badge color="var(--muted)">SigV4</Badge>
      ) : (
        <Badge color="var(--idp)">{t({ en: "Unsigned", ja: "署名なし" })}</Badge>
      )}
      {op.regionalOnly && (
        <Badge color="var(--deny)">
          {t({ en: "Regional only", ja: "リージョナル限定" })}
        </Badge>
      )}
      {op.partnerOnly && (
        <Badge color="var(--caller)">
          {t({ en: "Partners only", ja: "パートナー専用" })}
        </Badge>
      )}
      {op.since && (
        <Badge color="var(--sts)">
          {t({ en: `New in ${op.since}`, ja: `${op.since} 年追加` })}
        </Badge>
      )}
    </span>
  );
}
