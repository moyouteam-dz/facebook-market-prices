import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ReviewPage from "../../src/pages/ReviewPage";
import { ReviewSessionProvider } from "../../src/review/ReviewSessionContext";

const candidate = {
  id: "c1",
  original_product: "بطاط",
  product: "بطاط",
  normalized_product: "بطاط",
  price_min: 80,
  price_max: 80,
  currency: "DZD" as const,
  market: "الشلف",
  source_id: "s1",
  source_page: "سوق الجملة",
  post_id: "p1",
  post_url: "https://www.facebook.com/market/posts/1",
  post_date: "2026-09-18T00:00:00.000Z",
  source_type: "post_text" as const,
  raw_text: "بطاط 80 دج",
  confidence: "high" as const,
  accepted: true,
  remember_correction: false,
};

describe("ReviewPage", () => {
  it("lets the user edit extracted values and explicitly save results", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({
      saved: 1,
      rejected: 0,
      duplicates: 0,
    });

    render(
      <MemoryRouter>
        <ReviewSessionProvider
          initialSession={{ runId: "run-1", candidates: [candidate] }}
          saveHandler={onSave}
        >
          <ReviewPage />
        </ReviewSessionProvider>
      </MemoryRouter>,
    );

    const product = screen.getByLabelText("المنتج");
    await user.clear(product);
    await user.type(product, "بطاطا");

    const min = screen.getByLabelText("أدنى سعر");
    await user.clear(min);
    await user.type(min, "75");

    await user.click(screen.getByLabelText("تذكر هذا التصحيح"));
    await user.click(screen.getByRole("button", { name: "حفظ النتائج" }));

    expect(onSave).toHaveBeenCalledWith(
      "run-1",
      expect.arrayContaining([
        expect.objectContaining({
          product: "بطاطا",
          price_min: 75,
          price_max: 80,
          remember_correction: true,
        }),
      ]),
    );
  });

  it("can reject a candidate without removing its evidence from the review UI", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ReviewSessionProvider
          initialSession={{ runId: "run-1", candidates: [candidate] }}
          saveHandler={vi.fn()}
        >
          <ReviewPage />
        </ReviewSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("بطاط 80 دج")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "استبعاد" }));
    expect(screen.getByText("مستبعد")).toBeInTheDocument();
  });
});
