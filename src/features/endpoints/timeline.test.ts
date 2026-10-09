import { CHANGES } from "./timeline";

describe("endpoint timeline", () => {
  it("is in date order", () => {
    const dates = CHANGES.map((c) => c.date);
    expect([...dates].sort()).toEqual(dates);
  });
  it("has copy in both languages and an https source for every entry", () => {
    for (const c of CHANGES) {
      expect(c.title.en).not.toBe("");
      expect(c.title.ja).not.toBe("");
      expect(c.href).toMatch(/^https:\/\//);
    }
  });
});
