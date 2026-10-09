import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { TrustSection } from "./TrustSection";

const renderSection = () =>
  render(
    <LangProvider initial="en">
      <TrustSection />
    </LangProvider>,
  );

describe("TrustSection", () => {
  it("renders the chapter heading", () => {
    renderSection();
    expect(
      screen.getByRole("heading", { level: 2, name: /Trust policies decide/ }),
    ).toBeInTheDocument();
  });

  it("gates lab flips to denied when the trust policy is silent", async () => {
    renderSection();
    const lab = screen.getByText("Two gates in front of every role").closest("figure")!;
    expect(within(lab).getByText("Session issued")).toBeInTheDocument();
    const trustGroup = within(lab).getByRole("group", {
      name: /Role's trust policy for this caller/,
    });
    await userEvent.click(within(trustGroup).getByLabelText("Silent"));
    expect(within(lab).getAllByText("AccessDenied").length).toBeGreaterThan(0);
  });

  it("OIDC lab flags the world-open policy", async () => {
    renderSection();
    const lab = screen
      .getByText("Who can assume your GitHub deploy role?")
      .closest("figure")!;
    await userEvent.click(within(lab).getByLabelText("A stranger's repo"));
    await userEvent.click(within(lab).getByLabelText("repo:*"));
    expect(within(lab).getByText("Open to every GitHub repo")).toBeInTheDocument();
  });

  it("catalog search narrows the list", async () => {
    renderSection();
    const box = screen.getByRole("searchbox");
    await userEvent.type(box, "ExternalId");
    const fig = box.closest("figure")!;
    expect(within(fig).getByText("sts:ExternalId")).toBeInTheDocument();
    expect(within(fig).queryByText("aws:userid")).not.toBeInTheDocument();
  });
});
