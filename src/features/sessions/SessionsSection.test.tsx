import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { SessionsSection } from "./SessionsSection";

const renderSection = () =>
  render(
    <LangProvider initial="en">
      <SessionsSection />
    </LangProvider>,
  );

describe("SessionsSection", () => {
  it("dropping the session policy falls back to the default allow-all", async () => {
    renderSection();
    const table = screen.getByRole("table", { name: /Each row is a gate/ });
    const effective = () =>
      within(table)
        .getAllByRole("cell")
        .filter((c) => c.textContent === "Allow").length;
    expect(effective()).toBe(2);
    const sessionRow = within(table)
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Session policy"))!;
    await userEvent.click(within(sessionRow).getByRole("button", { name: "In play" }));
    expect(effective()).toBe(4);
  });

  it("a chained hop asking for 2 hours is rejected", async () => {
    renderSection();
    const selects = screen.getAllByLabelText("DurationSeconds");
    await userEvent.selectOptions(selects[1], "7200");
    expect(screen.getByText(/RoleC fails/)).toBeInTheDocument();
    expect(screen.getByText(/capped at 1 hour/)).toBeInTheDocument();
  });

  it("revoking shows the AWSRevokeOlderSessions policy", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Revoke active sessions" }));
    expect(
      screen.getByText(/AWSRevokeOlderSessions, added to the role/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("denied").length).toBeGreaterThan(0);
  });

  it("renders in Japanese", () => {
    render(
      <LangProvider initial="ja">
        <SessionsSection />
      </LangProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "セッションにできること、使える時間" }),
    ).toBeInTheDocument();
  });
});
