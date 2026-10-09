import { useEffect, useState } from "react";
import { NAV } from "@/data/nav";
import { useLang } from "@/i18n/useLang";

type Theme = "light" | "dark";
const THEME_KEY = "assume-role:theme";

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function Header() {
  const { lang, setLang, t } = useLang();
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: the toggle still applies for this visit.
    }
    setTheme(next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a
          href="#top"
          className="flex items-center gap-2 font-mono text-[0.95rem] font-semibold"
        >
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-6" />
          <span>
            sts:<span className="text-[var(--sts)]">AssumeRole</span>
          </span>
        </a>
        <nav
          aria-label={t({ en: "Chapters", ja: "章" })}
          className="ml-4 hidden flex-1 items-center gap-0.5 overflow-hidden lg:flex"
        >
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="rounded-md px-2 py-1 text-[0.82rem] font-medium whitespace-nowrap text-[var(--muted)] hover:bg-[var(--sunk)] hover:text-[var(--ink)]"
            >
              {t(n.label)}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label={t({ en: "Language", ja: "言語" })}
            className="flex rounded-lg border border-[var(--line)] p-0.5 text-xs font-bold"
          >
            {(["en", "ja"] as const).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className="min-h-8 min-w-9 rounded-md px-2 aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
              >
                {l === "en" ? "EN" : "日本語"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? t({ en: "Switch to light theme", ja: "ライトテーマにする" })
                : t({ en: "Switch to dark theme", ja: "ダークテーマにする" })
            }
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)]"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              {theme === "dark" ? (
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="4.5" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </g>
              ) : (
                <path
                  d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
                  fill="currentColor"
                />
              )}
            </svg>
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
            className="grid size-9 place-items-center rounded-lg border border-[var(--line)] lg:hidden"
          >
            <span className="sr-only">{t({ en: "Chapters", ja: "章" })}</span>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label={t({ en: "Chapters", ja: "章" })}
          className="border-t border-[var(--line)] bg-[var(--paper)] lg:hidden"
        >
          <ol className="mx-auto grid max-w-6xl grid-cols-2 gap-1 px-4 py-3 sm:grid-cols-3">
            {NAV.map((n, i) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  onClick={() => setOpen(false)}
                  className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-[var(--sunk)]"
                >
                  <span className="w-5 font-mono text-xs text-[var(--sts)] tabular-nums">
                    {i + 1}
                  </span>
                  {t(n.label)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </header>
  );
}
