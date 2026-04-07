import { render, screen } from "@testing-library/react";
import { Disc3 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/shell/empty-state";

describe("EmptyState", () => {
	it("renders heading text", () => {
		render(<EmptyState icon={Disc3} heading="Test Heading" body="Test body" />);
		expect(screen.getByText("Test Heading")).toBeInTheDocument();
	});

	it("renders body text", () => {
		render(<EmptyState icon={Disc3} heading="Test Heading" body="Test body" />);
		expect(screen.getByText("Test body")).toBeInTheDocument();
	});

	it("renders the icon as an SVG element", () => {
		const { container } = render(
			<EmptyState icon={Disc3} heading="Test Heading" body="Test body" />,
		);
		const svg = container.querySelector("svg");
		expect(svg).toBeInTheDocument();
	});
});
