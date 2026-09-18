import { describe, expect, it } from "vitest";
import { safeExternalHttpUrl } from "../../src/security/externalUrl";

describe("external URL safety", () => {
  it("keeps ordinary HTTPS links", () => {
    expect(safeExternalHttpUrl("https://www.facebook.com/Emagfel")).toBe(
      "https://www.facebook.com/Emagfel",
    );
  });

  it("rejects script and non-web protocols", () => {
    expect(safeExternalHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalHttpUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects malformed URLs and permits http only for explicit external evidence", () => {
    expect(safeExternalHttpUrl("not a url")).toBeNull();
    expect(safeExternalHttpUrl("http://example.com/post")).toBe("http://example.com/post");
  });
});
