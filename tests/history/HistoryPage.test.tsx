import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryPriceHistory: vi.fn(),
}));

vi.mock("../../src/history/historyExport", () => ({
  queryPriceHistory: mocks.queryPriceHistory,
}));

import HistoryPage from "../../src/pages/HistoryPage";

const base = {
  id: "r1",
  product: "بطاطا",
  normalized_product: "بطاطا",
  price_min: 70,
  price_max: 90,
  currency: "DZD" as const,
  market: "الشلف",
  source_id: "s1",
  source_page: "سوق الجملة",
  post_id: "p1",
  post_url: "https://facebook.com/post-1",
  source_type: "image_ai" as const,
  raw_text: "بطاطا 70 90",
  post_date: "2026-09-19T10:00:00.000Z",
  scraped_at: "2026-09-19T11:00:00.000Z",
  reviewed_at: "2026-09-19T11:05:00.000Z",
  confidence: "medium" as const,
  fingerprint: "fp-1",
};

describe("HistoryPage daily posts", () => {
  it("offers one copy action for the publish-ready daily post", async () => {
    mocks.queryPriceHistory.mockResolvedValueOnce([base]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<HistoryPage />);

    await screen.findByText("بطاطا");
    await userEvent.click(screen.getByRole("button", { name: "نسخ المنشور" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain("بطاطا: 70–90 دج");
    expect(screen.getByText("تم النسخ")).toBeInTheDocument();
  });

  it("keeps the daily post compact by default and reveals source details on demand", async () => {
    mocks.queryPriceHistory.mockResolvedValueOnce([
      base,
      {
        ...base,
        id: "r2",
        source_id: "s2",
        source_page: "سوق آخر",
        post_id: "p2",
        post_url: "https://facebook.com/post-2",
        fingerprint: "fp-2",
      },
    ]);

    render(<HistoryPage />);

    expect(await screen.findByText("بطاطا")).toBeInTheDocument();
    expect(screen.getByText("70 – 90")).toBeInTheDocument();
    expect(screen.getByText("1 منتج")).toBeInTheDocument();

    expect(screen.queryByText("مصدران")).not.toBeInTheDocument();
    expect(screen.queryByText("سوق الجملة")).not.toBeInTheDocument();
    expect(screen.queryByText("سوق آخر")).not.toBeInTheDocument();

    const button = screen.getByRole("button", { name: "عرض التفاصيل والمصادر" });
    await userEvent.click(button);

    expect(screen.getByText("مصدران")).toBeInTheDocument();
    expect(screen.getByText("سوق الجملة")).toBeInTheDocument();
    expect(screen.getByText("سوق آخر")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إخفاء التفاصيل" })).toBeInTheDocument();
  });
});
