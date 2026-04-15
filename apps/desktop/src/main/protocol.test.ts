import { vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		setAsDefaultProtocolClient: vi.fn(),
	},
}));

import { describe, expect, it } from "vitest";
import { parseProtocolUrl } from "./protocol";

describe("parseProtocolUrl", () => {
  it("parses trade handoff URLs", () => {
    const payload = parseProtocolUrl(
      "digswap://trade/550e8400-e29b-41d4-a716-446655440000?handoff=abc123",
    );

    expect(payload).toMatchObject({
      kind: "trade-handoff",
      token: "abc123",
      tradeId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("rejects malformed trade ids", () => {
    expect(parseProtocolUrl("digswap://trade/not-a-uuid?handoff=abc123")).toBeNull();
  });
});
