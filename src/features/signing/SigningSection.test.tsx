import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LangProvider } from "@/i18n/LangContext";
import { SigningSection } from "./SigningSection";

const setup = (initial: "en" | "ja" = "en") =>
  render(
    <LangProvider initial={initial}>
      <SigningSection />
    </LangProvider>,
  );

describe("SigningSection", () => {
  it("signs live and flags a tampered request", async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByText("✓ Matches the original");
    await user.type(screen.getByLabelText("path"), "x");
    await screen.findByText(/SignatureDoesNotMatch: AWS would reject this/);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await screen.findByText("✓ Matches the original");
  });

  it("breaks the signature when the session token is left unsigned", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Temporary credentials → S3" }));
    const box = await screen.findByRole("checkbox", {
      name: /Leave x-amz-security-token out of SignedHeaders/,
    });
    await user.click(box);
    await screen.findByText(/SignatureDoesNotMatch: AWS would reject this/);
  });

  it("puts the session token in a presigned URL and verifies SigV4a", async () => {
    setup();
    const url = await screen.findByLabelText("presigned URL");
    expect(url.textContent).toContain("X-Amz-Security-Token=");
    expect(url.textContent).toContain("X-Amz-Expires=900");
    await screen.findByText("✓ Verifies against the public key alone");
    const scope = screen.getByLabelText("credential scope");
    await waitFor(() => expect(scope.textContent).toBe("20260919/s3/aws4_request"));
  });

  it("opens a wire annotation", async () => {
    setup("ja");
    const user = userEvent.setup();
    const bearer = screen.getByRole("button", {
      name: "Bearer ABSKQmVkcm9ja0FQSUtleS1leGFtcGxl...",
    });
    await user.click(bearer);
    expect(bearer).toHaveAttribute("aria-pressed", "true");
    expect(
      within(bearer.closest("div")!).getByText(
        /この文字列を持っている人が呼び出し元です/,
      ),
    ).toBeInTheDocument();
  });
});
