import type { L } from "@/i18n/lang";

/** Chapters in reading order. Section components take their number from here. */
export const NAV: { id: string; label: L }[] = [
  { id: "why", label: { en: "Why temporary", ja: "なぜ一時認証か" } },
  { id: "endpoints", label: { en: "Endpoints", ja: "エンドポイント" } },
  { id: "api", label: { en: "Every API", ja: "全 API" } },
  { id: "paths", label: { en: "Credential paths", ja: "取得経路" } },
  { id: "sessions", label: { en: "Sessions", ja: "セッション" } },
  { id: "trust", label: { en: "Trust policies", ja: "信頼ポリシー" } },
  { id: "ops", label: { en: "Logs & limits", ja: "ログと上限" } },
  { id: "errors", label: { en: "Errors", ja: "エラー" } },
  { id: "timeline", label: { en: "Timeline", ja: "年表" } },
  { id: "glossary", label: { en: "Glossary", ja: "用語集" } },
];

export const chapter = (id: string) => NAV.findIndex((n) => n.id === id) + 1;
