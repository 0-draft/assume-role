import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useLang } from "@/i18n/useLang";
import { Hero } from "@/features/hero/Hero";
import { WhySection } from "@/features/why/WhySection";
import { EndpointsSection } from "@/features/endpoints/EndpointsSection";
import { ApiSection } from "@/features/api/ApiSection";
import { PathsSection } from "@/features/paths/PathsSection";
import { SessionsSection } from "@/features/sessions/SessionsSection";
import { TrustSection } from "@/features/trust/TrustSection";
import { OpsSection } from "@/features/ops/OpsSection";
import { ErrorsSection } from "@/features/errors/ErrorsSection";
import { TimelineSection } from "@/features/timeline/TimelineSection";
import { GlossarySection } from "@/features/glossary/GlossarySection";

export default function App() {
  const { t } = useLang();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-[var(--sts)] focus:px-4 focus:py-2 focus:text-[var(--on-color)]"
      >
        {t({ en: "Skip to content", ja: "本文へスキップ" })}
      </a>
      <Header />
      <main id="main" className="mx-auto max-w-6xl px-4 sm:px-6">
        <span id="top" />
        <Hero />
        <WhySection />
        <EndpointsSection />
        <ApiSection />
        <PathsSection />
        <SessionsSection />
        <TrustSection />
        <OpsSection />
        <ErrorsSection />
        <TimelineSection />
        <GlossarySection />
      </main>
      <Footer />
    </>
  );
}
