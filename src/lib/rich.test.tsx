import { render } from "@testing-library/react";
import { rich } from "./rich";

describe("rich", () => {
  it("turns backticks into chips and **x** into strong", () => {
    const { container } = render(<p>{rich("Call `AssumeRole` **now**, ok")}</p>);
    expect(container.querySelector("code")?.textContent).toBe("AssumeRole");
    expect(container.querySelector("strong")?.textContent).toBe("now");
    expect(container.textContent).toBe("Call AssumeRole now, ok");
  });

  it("leaves plain text alone", () => {
    expect(rich("plain")).toEqual(["plain"]);
  });
});
