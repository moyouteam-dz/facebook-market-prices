import { describe, expect, it } from "vitest";
import { matchSourceForApifyItem } from "../../src/apify/sourceMatch";

const sources = [
  {
    id: "emagfel",
    name: "Emagfel",
    market: "سوق 1",
    facebook_url: "https://www.facebook.com/Emagfel",
    enabled: true,
  },
  {
    id: "ouarsenis",
    name: "Ouarsenis",
    market: "سوق 2",
    facebook_url: "https://www.facebook.com/MagrosOuarsenisBourached",
    enabled: true,
  },
];

describe("Apify source matching", () => {
  it("matches by inputUrl or a post topLevelUrl", () => {
    expect(
      matchSourceForApifyItem(
        { inputUrl: "https://www.facebook.com/Emagfel" },
        sources,
      )?.id,
    ).toBe("emagfel");

    expect(
      matchSourceForApifyItem(
        {
          topLevelUrl:
            "https://www.facebook.com/MagrosOuarsenisBourached/posts/123",
        },
        sources,
      )?.id,
    ).toBe("ouarsenis");
  });

  it("does not silently assign an unmatched item to the first source", () => {
    expect(
      matchSourceForApifyItem(
        { inputUrl: "https://www.facebook.com/SomeOtherPage" },
        sources,
      ),
    ).toBeUndefined();
  });

  it("normalizes mobile host and trailing slash", () => {
    expect(
      matchSourceForApifyItem(
        { inputUrl: "https://m.facebook.com/Emagfel/" },
        sources,
      )?.id,
    ).toBe("emagfel");
  });
});
