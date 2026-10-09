import { render } from "@testing-library/react";
import { rich, softBreaks } from "./rich";

describe("rich", () => {
  it("turns backticks into chips and **x** into strong", () => {
    const { container } = render(<p>{rich("Call `AssumeRole` **now**, ok")}</p>);
    expect(container.querySelector("code")?.textContent).toBe("AssumeRole");
    expect(container.querySelector("strong")?.textContent).toBe("now");
    expect(container.textContent).toBe("Call AssumeRole now, ok");
  });

  it("renders code inside bold", () => {
    const { container } = render(<p>{rich("**GitHub `sub` claims changed.** Then")}</p>);
    expect(container.querySelector("strong code")?.textContent).toBe("sub");
    expect(container.textContent).toBe("GitHub sub claims changed. Then");
  });

  it("keeps short chips on one line but lets long ones wrap", () => {
    const { container } = render(
      <p>{rich("`us-east-1` and `arn:aws:sts::123456789012:assumed-role/a/b`")}</p>,
    );
    const [short, long] = container.querySelectorAll("code");
    expect(short.className).toContain("whitespace-nowrap");
    expect(long.className).not.toContain("whitespace-nowrap");
  });

  it("leaves plain text alone", () => {
    expect(rich("plain")).toEqual(["plain"]);
  });
});

describe("softBreaks", () => {
  it("adds break points at camel-case and dots without changing text", () => {
    const { container } = render(<span>{softBreaks("AssumeRoleWithWebIdentity")}</span>);
    expect(container.textContent).toBe("AssumeRoleWithWebIdentity");
    expect(container.querySelectorAll("wbr").length).toBe(4);
    const host = render(<span>{softBreaks("sts.us-east-1.amazonaws.com")}</span>);
    expect(host.container.querySelectorAll("wbr").length).toBe(3);
  });
});
