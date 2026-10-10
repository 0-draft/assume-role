import { NAV } from "@/data/nav";
import {
  CATEGORIES,
  EVENTS,
  chapterOf,
  dateKey,
  isValidDate,
  softBreakPoints,
} from "./events";

describe("timeline events", () => {
  it("every date is a valid YYYY, YYYY-MM or YYYY-MM-DD", () => {
    for (const e of EVENTS) expect(isValidDate(e.date), e.date).toBe(true);
  });

  it("are in date order", () => {
    const keys = EVENTS.map((e) => dateKey(e.date));
    expect(keys).toEqual([...keys].sort());
  });

  it("have bilingual copy, a known category, and a source unless unverified", () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const e of EVENTS) {
      expect(cats.has(e.category)).toBe(true);
      for (const l of [e.title, e.detail]) {
        expect(l.en.length).toBeGreaterThan(0);
        expect(l.ja.length).toBeGreaterThan(0);
      }
      if (!e.unverified) expect(e.source, e.title.en).toMatch(/^https:\/\//);
    }
  });

  it("span 2011 to 2026", () => {
    expect(EVENTS[0].date.startsWith("2011")).toBe(true);
    expect(EVENTS.at(-1)?.date.startsWith("2026")).toBe(true);
  });
});

describe("date helpers", () => {
  it("pads partial dates and rejects impossible ones", () => {
    expect(dateKey("2019")).toBe("2019-01-01");
    expect(dateKey("2019-11")).toBe("2019-11-01");
    expect(isValidDate("2025-02-30")).toBe(false);
    expect(isValidDate("2025-13")).toBe(false);
    expect(isValidDate("25-01")).toBe(false);
  });
});

describe("chapter links", () => {
  it("every event links to a real chapter", () => {
    const ids = new Set(NAV.map((n) => n.id));
    for (const e of EVENTS) expect(ids.has(chapterOf(e)), e.title.en).toBe(true);
  });
});

describe("softBreakPoints", () => {
  it("splits long camel-case identifiers at word boundaries", () => {
    expect(softBreakPoints("AssumeRoleWithWebIdentity")).toEqual([
      "Assume",
      "Role",
      "With",
      "Web",
      "Identity",
    ]);
    expect(softBreakPoints("Session tags")).toEqual(["Session tags"]);
  });
});
