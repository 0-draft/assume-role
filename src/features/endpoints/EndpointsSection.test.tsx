import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { EndpointsSection } from "./EndpointsSection";

const fig = (title: RegExp) => screen.getByText(title).closest("figure")!;

const setup = () =>
  render(
    <LangProvider initial="en">
      <EndpointsSection />
    </LangProvider>,
  );

describe("EndpointsSection", () => {
  it("routes a global call from Stockholm locally, then back to us-east-1 before April 2025", async () => {
    setup();
    const sim = fig(/Where does my STS request actually go/);
    const served = () => within(sim).getByText("Served in").nextElementSibling!;
    expect(served().textContent).toContain("eu-north-1");
    await userEvent.click(within(sim).getByRole("radio", { name: "Before Apr 2025" }));
    expect(served().textContent).toContain("us-east-1");
  });

  it("shows RegionDisabledException when STS is deactivated in the Region", async () => {
    setup();
    const sim = fig(/Where does my STS request actually go/);
    await userEvent.click(within(sim).getByRole("radio", { name: /^sts\.eu-north-1/ }));
    await userEvent.click(within(sim).getByRole("radio", { name: "Deactivated" }));
    expect(within(sim).getByRole("alert").textContent).toContain(
      "RegionDisabledException",
    );
  });

  it("says FIPS doesn't exist in Tokyo", async () => {
    setup();
    const box = fig(/Anatomy of an STS hostname/);
    await userEvent.click(within(box).getByRole("radio", { name: "FIPS" }));
    expect(within(box).getByText("No such window")).toBeInTheDocument();
    expect(
      within(box).getByText("sts-fips.ap-northeast-1.amazonaws.com"),
    ).toBeInTheDocument();
  });

  it("filters the departure board", async () => {
    setup();
    const box = fig(/Every Regional window/);
    await userEvent.type(within(box).getByRole("searchbox"), "osaka");
    expect(within(box).getAllByRole("row")).toHaveLength(2);
  });
});
