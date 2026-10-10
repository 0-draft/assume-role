import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useLang } from "@/i18n/useLang";
import { NAV } from "@/data/nav";
import { Hero } from "@/features/hero/Hero";
import { WhySection } from "@/features/why/WhySection";

// Everything below the first chapter is split into its own chunks. The imports
// start at module load, in parallel, so they are usually in before anyone
// scrolls; the first paint only waits for the hero and chapter 1.
const named = <K extends string>(p: Promise<Record<K, ComponentType>>, k: K) =>
  lazy(() => p.then((m) => ({ default: m[k] })));
const EndpointsSection = named(
  import("@/features/endpoints/EndpointsSection"),
  "EndpointsSection",
);
const ApiSection = named(import("@/features/api/ApiSection"), "ApiSection");
const PathsSection = named(import("@/features/paths/PathsSection"), "PathsSection");
const SessionsSection = named(
  import("@/features/sessions/SessionsSection"),
  "SessionsSection",
);
const TrustSection = named(import("@/features/trust/TrustSection"), "TrustSection");
const OpsSection = named(import("@/features/ops/OpsSection"), "OpsSection");
const ErrorsSection = named(import("@/features/errors/ErrorsSection"), "ErrorsSection");
const TimelineSection = named(
  import("@/features/timeline/TimelineSection"),
  "TimelineSection",
);
const GlossarySection = named(
  import("@/features/glossary/GlossarySection"),
  "GlossarySection",
);

/** Empty chapters with the real ids, so #anchors resolve while chunks load. */
function Placeholders() {
  return NAV.filter((n) => n.id !== "why").map((n) => (
    <section key={n.id} id={n.id} aria-busy className="min-h-screen" />
  ));
}

/** A deep link like #trust was followed before its chapter existed; go there now. */
function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}

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
        <Suspense fallback={<Placeholders />}>
          <EndpointsSection />
          <ApiSection />
          <PathsSection />
          <SessionsSection />
          <TrustSection />
          <OpsSection />
          <ErrorsSection />
          <TimelineSection />
          <GlossarySection />
          <ScrollToHash />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
