import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { OpsSection } from "./OpsSection";

describe("OpsSection", () => {
  it("explains a tapped CloudTrail field and shows the missing record for denied calls", async () => {
    render(
      <LangProvider initial="en">
        <OpsSection />
      </LangProvider>,
    );
    await userEvent.click(screen.getAllByRole("button", { name: '"sharedEventID"' })[0]);
    expect(screen.getByText(/Join on it to see both halves/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("radio", { name: "Denied cross-account call" }),
    );
    expect(screen.getByText("No record")).toBeInTheDocument();
  });
});
