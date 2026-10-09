import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { LangProvider } from "@/i18n/LangContext";

describe("App", () => {
  it("renders in English by default and switches to Japanese", async () => {
    render(
      <LangProvider>
        <App />
      </LangProvider>,
    );
    expect(document.documentElement.lang).toBe("en");
    await userEvent.click(screen.getByRole("button", { name: "日本語" }));
    expect(document.documentElement.lang).toBe("ja");
    expect(window.location.search).toBe("?lang=ja");
  });
});
