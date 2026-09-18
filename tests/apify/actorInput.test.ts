import { describe, expect, it } from "vitest";
import { buildFacebookActorInput } from "../../src/apify/actorInput";

describe("Facebook actor input", () => {
  it("uses the approved bounded manual-refresh defaults", () => {
    expect(
      buildFacebookActorInput([
        "https://www.facebook.com/Emagfel",
        "https://www.facebook.com/MagrosOuarsenisBourached",
      ]),
    ).toEqual({
      captionText: false,
      resultsLimit: 5,
      onlyPostsNewerThan: "7 days",
      startUrls: [
        { url: "https://www.facebook.com/Emagfel" },
        { url: "https://www.facebook.com/MagrosOuarsenisBourached" },
      ],
    });
  });

  it("deduplicates and trims source URLs before sending them to Apify", () => {
    expect(
      buildFacebookActorInput([
        " https://www.facebook.com/Emagfel ",
        "https://www.facebook.com/Emagfel",
      ]).startUrls,
    ).toEqual([{ url: "https://www.facebook.com/Emagfel" }]);
  });
});
