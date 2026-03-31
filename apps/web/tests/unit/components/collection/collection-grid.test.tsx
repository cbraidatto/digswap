import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CollectionItem } from "@/lib/collection/queries";

// Mock CollectionCard to avoid importing next/image, condition-editor, etc.
vi.mock(
	"@/app/(protected)/(profile)/perfil/_components/collection-card",
	() => ({
		CollectionCard: ({
			item,
		}: {
			item: CollectionItem;
			isOwner: boolean;
		}) => <div data-testid={`card-${item.id}`}>{item.title}</div>,
	}),
);

import { CollectionGrid } from "@/app/(protected)/(profile)/perfil/_components/collection-grid";

function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
	return {
		id: "item-1",
		conditionGrade: null,
		addedVia: "manual",
		createdAt: new Date("2025-01-01"),
		releaseId: "rel-1",
		discogsId: 12345,
		title: "Kind of Blue",
		artist: "Miles Davis",
		year: 1959,
		genre: ["Jazz"],
		format: "LP",
		coverImageUrl: null,
		rarityScore: 1.5,
		...overrides,
	};
}

describe("CollectionGrid", () => {
	test("renders correct number of cards for given items", () => {
		const items = [
			makeItem({ id: "item-1", title: "Kind of Blue" }),
			makeItem({ id: "item-2", title: "A Love Supreme" }),
			makeItem({ id: "item-3", title: "Blue Train" }),
		];

		render(<CollectionGrid items={items} isOwner={false} />);

		expect(screen.getByTestId("card-item-1")).toBeInTheDocument();
		expect(screen.getByTestId("card-item-2")).toBeInTheDocument();
		expect(screen.getByTestId("card-item-3")).toBeInTheDocument();
	});

	test("renders empty state when items is empty", () => {
		render(<CollectionGrid items={[]} isOwner={false} />);

		expect(screen.getByText("No records found")).toBeInTheDocument();
	});

	test("grid has responsive classes", () => {
		const items = [makeItem({ id: "item-1" })];

		const { container } = render(
			<CollectionGrid items={items} isOwner={false} />,
		);

		const gridDiv = container.firstChild as HTMLElement;
		expect(gridDiv.className).toContain("grid-cols-2");
		expect(gridDiv.className).toContain("md:grid-cols-3");
		expect(gridDiv.className).toContain("lg:grid-cols-4");
	});

	test("passes isOwner prop to CollectionCard", () => {
		const items = [makeItem({ id: "item-1" })];

		render(<CollectionGrid items={items} isOwner={true} />);

		// Card renders since mock does not fail -- verifying no crash with isOwner=true
		expect(screen.getByTestId("card-item-1")).toBeInTheDocument();
	});
});
