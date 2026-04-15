import { vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		setAsDefaultProtocolClient: vi.fn(),
	},
}));

import { describe, expect, it } from "vitest";
import { parseProtocolUrl } from "./protocol";

describe("parseProtocolUrl", () => {
  it("parses min desktop version and protocol version from trade handoff URLs", () => {
    const payload = parseProtocolUrl(
      "digswap://trade/550e8400-e29b-41d4-a716-446655440000?handoff=abc123&mv=0.2.0&tpv=2",
    );

    expect(payload).toMatchObject({
      kind: "trade-handoff",
      minDesktopVersion: "0.2.0",
      token: "abc123",
      tradeId: "550e8400-e29b-41d4-a716-446655440000",
      tradeProtocolVersion: 2,
    });
  });

  it("rejects malformed trade ids", () => {
    expect(parseProtocolUrl("digswap://trade/not-a-uuid?handoff=abc123")).toBeNull();
  });
});
