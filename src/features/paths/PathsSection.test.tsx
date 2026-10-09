import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { PathsSection } from "./PathsSection";

const setup = () =>
  render(
    <LangProvider initial="en">
      <PathsSection />
    </LangProvider>,
  );

describe("PathsSection", () => {
  it("switches paths and steps through the sequence", async () => {
    setup();
    const user = userEvent.setup();
    expect(
      screen.getByRole("heading", { name: "EC2 instance profile (IMDSv2)" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "EKS Pod Identity" }));
    expect(screen.getByRole("heading", { name: "EKS Pod Identity" })).toBeInTheDocument();
    expect(
      screen.getAllByText("eks-auth:AssumeRoleForPodIdentity").length,
    ).toBeGreaterThan(0);
    const seq = screen.getByRole("group", { name: /Sequence diagram: EKS Pod Identity/ });
    expect(within(seq).getByText("Step 1 / 6")).toBeInTheDocument();
    await user.click(within(seq).getByRole("button", { name: "Next" }));
    expect(within(seq).getByText("Step 2 / 6")).toBeInTheDocument();
  });

  it("shows which provider wins in the chain lab", async () => {
    setup();
    const user = userEvent.setup();
    expect(screen.getByText(/AWS CLI signs with web identity token/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Access keys in env/ }));
    expect(
      screen.getByText(/AWS CLI signs with environment variables/),
    ).toBeInTheDocument();
  });
});
