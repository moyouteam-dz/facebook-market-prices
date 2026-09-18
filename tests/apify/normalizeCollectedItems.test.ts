import { describe, expect, it } from "vitest";
import { normalizeCollectedFacebookItems } from "../../src/apify/normalizeCollectedItems";

const sources = [
  {
    id: "known",
    name: "Known",
    market: "الشلف",
    facebook_url: "https://www.facebook.com/Emagfel",
    enabled: true,
  },
];

describe("normalizing collected Facebook items", () => {
  it("drops an item when Apify source evidence cannot be matched", () => {
    expect(
      normalizeCollectedFacebookItems(
        [
          {
            inputUrl: "https://www.facebook.com/OtherPage",
            postId: "wrong",
            text: "بطاطا 1 دج",
          },
        ],
        sources,
      ),
    ).toEqual([]);
  });

  it("keeps a matched item with the configured market and source id", () => {
    const result = normalizeCollectedFacebookItems(
      [
        {
          inputUrl: "https://m.facebook.com/Emagfel/",
          postId: "post-1",
          text: "بطاطا 80 دج",
        },
      ],
      sources,
    );

    expect(result).toEqual([
      expect.objectContaining({
        post_id: "post-1",
        source_id: "known",
        market: "الشلف",
      }),
    ]);
  });
});
