import { AS_OF } from "@/data/asOf";
import { useLang } from "@/i18n/useLang";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-[var(--line)] py-10 text-sm text-[var(--muted)]">
      <div className="mx-auto max-w-6xl space-y-2 px-4 sm:px-6">
        <p>
          {t({
            en: `Facts checked against AWS documentation on ${AS_OF}. AWS changes STS behaviour from time to time; every chapter links the primary source so you can re-check.`,
            ja: `${AS_OF} 時点の AWS ドキュメントで確認した内容です。STS の挙動は変わることがあるので、各章に一次情報へのリンクを付けています。`,
          })}
        </p>
        <p>
          {t({
            en: "Not affiliated with Amazon Web Services. All account IDs, keys and tokens shown are fake.",
            ja: "Amazon Web Services とは無関係の個人プロジェクトです。表示しているアカウント ID・キー・トークンはすべて架空です。",
          })}
        </p>
        <p>
          <a
            className="underline underline-offset-2"
            href="https://github.com/0-draft/assume-role"
          >
            github.com/0-draft/assume-role
          </a>
        </p>
      </div>
    </footer>
  );
}
