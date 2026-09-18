import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("App", () => {
  it("renders an Arabic RTL home with the manual refresh action", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(
      screen.getByRole("heading", { name: "أسعار الأسواق" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "تحديث الأسعار الآن" }),
    ).toHaveAttribute("href", "/update");
  });
});
