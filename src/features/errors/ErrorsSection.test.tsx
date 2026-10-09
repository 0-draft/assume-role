import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { ErrorsSection } from "./ErrorsSection";

describe("ErrorsSection", () => {
  it("decodes a pasted message and links to the chapter", async () => {
    render(
      <LangProvider initial="en">
        <ErrorsSection />
      </LangProvider>,
    );
    const box = screen.getByLabelText("Error message");
    await userEvent.type(box, "Rate exceeded");
    expect(screen.getAllByText("ThrottlingException").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /How this works/ })).toHaveAttribute(
      "href",
      "#ops",
    );
  });

  it("says so when nothing matches", async () => {
    render(
      <LangProvider initial="en">
        <ErrorsSection />
      </LangProvider>,
    );
    await userEvent.type(screen.getByLabelText("Error message"), "banana");
    expect(screen.getByText(/No documented STS error matches/)).toBeInTheDocument();
  });
});
