import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { ApiSection } from "./ApiSection";

const setup = () =>
  render(
    <LangProvider initial="en">
      <ApiSection />
    </LangProvider>,
  );

describe("ApiSection", () => {
  it("lights up the windows that match what you hold and prints the first one", async () => {
    setup();
    await userEvent.click(screen.getByRole("radio", { name: "IAM user access keys" }));
    const matched = document.querySelectorAll('button[data-match="true"]');
    expect([...matched].map((b) => b.querySelector(".font-mono")?.textContent)).toEqual([
      "AssumeRole",
      "GetSessionToken",
      "GetFederationToken",
    ]);
    expect(
      screen.getByRole("heading", { level: 3, name: "AssumeRole" }),
    ).toBeInTheDocument();
  });

  it("prints the pass for any window you select", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^AssumeRoot/ }));
    const pass = screen.getByRole("article", { name: "AssumeRoot" });
    expect(within(pass).getByText("15 min")).toBeInTheDocument();
    expect(within(pass).getAllByText("Regional only").length).toBeGreaterThan(0);
  });

  it("decodes an ID typed into the decoder", async () => {
    setup();
    const input = screen.getByLabelText(/access key ID, unique ID/);
    await userEvent.clear(input);
    await userEvent.type(input, "AKIAI44QH8DHBEXAMPLE");
    expect(screen.getByText("Access key (long-term)")).toBeInTheDocument();
  });

  it("renders in Japanese", () => {
    render(
      <LangProvider initial="ja">
        <ApiSection />
      </LangProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "窓口は 1 つではなく 11 個" }),
    ).toBeInTheDocument();
  });
});
