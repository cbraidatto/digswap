import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GemBadge } from "@/components/ui/gem-badge";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Hexagon: (props: Record<string, unknown>) => (
    <svg data-testid="icon-hexagon" {...props} />
  ),
  Gem: (props: Record<string, unknown>) => (
    <svg data-testid="icon-gem" {...props} />
  ),
  Diamond: (props: Record<string, unknown>) => (
    <svg data-testid="icon-diamond" {...props} />
  ),
}));

describe("GemBadge", () => {
  it("renders nothing when score is null", () => {
    const { container } = render(<GemBadge score={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when score is undefined", () => {
    const { container } = render(<GemBadge score={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Quartzo text for score 0.1", () => {
    render(<GemBadge score={0.1} />);
    expect(screen.getByText("Quartzo")).toBeInTheDocument();
  });

  it("renders Ametista text for score 0.5", () => {
    render(<GemBadge score={0.5} />);
    expect(screen.getByText("Ametista")).toBeInTheDocument();
  });

  it("renders Esmeralda text for score 1.0", () => {
    render(<GemBadge score={1.0} />);
    expect(screen.getByText("Esmeralda")).toBeInTheDocument();
  });

  it("renders Rubi text for score 2.0", () => {
    render(<GemBadge score={2.0} />);
    expect(screen.getByText("Rubi")).toBeInTheDocument();
  });

  it("renders Safira text for score 4.0", () => {
    render(<GemBadge score={4.0} />);
    expect(screen.getByText("Safira")).toBeInTheDocument();
  });

  it("renders Diamante text for score 7.0", () => {
    render(<GemBadge score={7.0} />);
    expect(screen.getByText("Diamante")).toBeInTheDocument();
  });

  it("shows weight multiplier when showScore is true", () => {
    render(<GemBadge score={7.0} showScore />);
    expect(screen.getByText("x100")).toBeInTheDocument();
  });

  it("does not show weight multiplier by default", () => {
    render(<GemBadge score={7.0} />);
    expect(screen.queryByText("x100")).not.toBeInTheDocument();
  });

  it("includes aria-label with tier name and weight", () => {
    render(<GemBadge score={7.0} />);
    const badge = screen.getByLabelText(/Diamante gem/i);
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute("aria-label")).toContain("weight 100");
  });

  it("uses Hexagon icon for quartz tier", () => {
    render(<GemBadge score={0.1} />);
    expect(screen.getByTestId("icon-hexagon")).toBeInTheDocument();
  });

  it("uses Gem icon for amethyst tier", () => {
    render(<GemBadge score={0.5} />);
    expect(screen.getByTestId("icon-gem")).toBeInTheDocument();
  });

  it("uses Diamond icon for sapphire tier", () => {
    render(<GemBadge score={4.0} />);
    expect(screen.getByTestId("icon-diamond")).toBeInTheDocument();
  });

  it("uses Diamond icon for diamond tier", () => {
    render(<GemBadge score={7.0} />);
    expect(screen.getByTestId("icon-diamond")).toBeInTheDocument();
  });

  it("applies animate-gem-prismatic class for diamond tier", () => {
    render(<GemBadge score={7.0} />);
    const badge = screen.getByLabelText(/Diamante gem/i);
    expect(badge.className).toContain("animate-gem-prismatic");
  });

  it("applies custom className", () => {
    render(<GemBadge score={0.1} className="my-custom" />);
    const badge = screen.getByLabelText(/Quartzo gem/i);
    expect(badge.className).toContain("my-custom");
  });
});
