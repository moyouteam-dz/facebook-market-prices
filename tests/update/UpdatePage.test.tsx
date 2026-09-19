import "fake-indexeddb/auto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { createAppDatabase } from "../../src/db/database";
import { ReviewSessionProvider } from "../../src/review/ReviewSessionContext";
import UpdatePage from "../../src/pages/UpdatePage";

const databases: ReturnType<typeof createAppDatabase>[] = [];

function dbWithConfig() {
  const db = createAppDatabase(`update-page-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

describe("manual update page", () => {
  it("runs selected enabled sources and sends extracted candidates to review", async () => {
    const db = dbWithConfig();
    await db.secret_settings.put({ key: "apify_token", value: "apify_api_test" });
    await db.sources.add({
      id: "source-1",
      name: "سوق الشلف",
      market: "الشلف",
      facebook_url: "https://www.facebook.com/Emagfel",
      enabled: true,
      created_at: "2026-09-18T00:00:00.000Z",
      updated_at: "2026-09-18T00:00:00.000Z",
    });

    const collectPosts = vi.fn().mockResolvedValue([
      {
        post_id: "post-1",
        source_id: "source-1",
        source_page: "Emagfel",
        market: "الشلف",
        post_url: "https://facebook.com/post-1",
        post_date: "2026-09-18T05:00:00.000Z",
        text: "بطاطا 80 دج",
        image_urls: [],
        unavailable: false,
      },
    ]);
    const setSession = vi.fn();
    const navigate = vi.fn();

    render(
      <MemoryRouter>
        <ReviewSessionProvider>
          <UpdatePage
            database={db}
            collectPosts={collectPosts}
            createOcrEngine={() => ({ recognize: vi.fn() })}
            setReviewSession={setSession}
            navigate={navigate}
          />
        </ReviewSessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("سوق الشلف")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /سوق الشلف/ })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "بدء التحديث" }));

    expect(await screen.findByText(/تم العثور على 1 نتيجة/)).toBeInTheDocument();
    expect(setSession).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            product: "بطاطا",
            price_min: 80,
            price_max: 80,
          }),
        ],
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/review");
  });

  it("shows a clear Arabic message when token is missing", async () => {
    const db = dbWithConfig();
    await db.sources.add({
      id: "source-1",
      name: "سوق الشلف",
      market: "الشلف",
      facebook_url: "https://www.facebook.com/Emagfel",
      enabled: true,
      created_at: "2026-09-18T00:00:00.000Z",
      updated_at: "2026-09-18T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <ReviewSessionProvider>
          <UpdatePage database={db} />
        </ReviewSessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("checkbox", { name: /سوق الشلف/ })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "بدء التحديث" }));
    expect(await screen.findByText("أدخل مفتاح Apify أولًا من الإعدادات.")).toBeInTheDocument();
  });
  it("shows friendly Arabic diagnostics instead of internal error codes when no prices are found", async () => {
    const db = dbWithConfig();
    await db.secret_settings.put({ key: "apify_token", value: "apify_api_test" });
    await db.sources.add({
      id: "source-1", name: "سوق الشلف", market: "الشلف",
      facebook_url: "https://www.facebook.com/Emagfel", enabled: true,
      created_at: "2026-09-18T00:00:00.000Z", updated_at: "2026-09-18T00:00:00.000Z",
    });
    const collectPosts = vi.fn().mockResolvedValue([{
      post_id:"post-1", source_id:"source-1", source_page:"Emagfel", market:"الشلف",
      post_url:"https://facebook.com/post-1", post_date:"2026-09-18T05:00:00.000Z",
      text:"لا توجد أسعار", image_urls:["https://example.test/a.jpg"], unavailable:false,
    }]);
    render(
      <MemoryRouter><ReviewSessionProvider>
        <UpdatePage database={db} collectPosts={collectPosts}
          createOcrEngine={() => ({ recognize: vi.fn().mockRejectedValue(new Error("ocr_init_failed")) })} />
      </ReviewSessionProvider></MemoryRouter>,
    );
    await screen.findByText("سوق الشلف");
    await userEvent.click(screen.getByRole("button", { name: "بدء التحديث" }));
    const message = await screen.findByText(/لم يتم العثور على أسعار/);
    expect(message).toHaveTextContent("تعذر تشغيل قارئ الصور: 1");
    expect(message).not.toHaveTextContent("ocr_init_failed");
  });
});
