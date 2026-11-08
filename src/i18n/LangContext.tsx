import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { type Lang, readStoredLang, resolveInitialLang, storeLang } from "./lang";
import { LangContext, type LangValue } from "./context";

const TITLE: Record<Lang, string> = {
  en: "aws-credentials: AWS credentials, drawn",
  ja: "aws-credentials: 図解 AWS 認証情報",
};

export function LangProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(
    () => initial ?? resolveInitialLang(window.location.search, readStoredLang()),
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = TITLE[lang];
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    storeLang(next);
    const url = new URL(window.location.href);
    if (next === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  }, []);

  const value = useMemo<LangValue>(
    () => ({ lang, setLang, t: (copy) => copy[lang] }),
    [lang, setLang],
  );

  return <LangContext value={value}>{children}</LangContext>;
}
