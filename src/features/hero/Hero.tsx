import { useLang } from "@/i18n/useLang";

export function Hero() {
  const { t } = useLang();
  return (
    <section className="py-16 sm:py-24">
      <h1 className="max-w-4xl text-5xl leading-[1.02] font-bold sm:text-7xl">
        {t({
          en: "Every AWS credential you didn't type was printed by STS.",
          ja: "あなたが打ち込んでいない AWS 認証情報は、ぜんぶ STS が発行している。",
        })}
      </h1>
    </section>
  );
}
