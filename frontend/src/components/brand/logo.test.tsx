import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./logo";

describe("Logo (Red Figure)", () => {
  it("renders main variant by default", () => {
    render(<Logo />);
    const svg = screen.getByRole("img", { name: /elite pinup/i });
    expect(svg).toBeInTheDocument();
    expect(svg.tagName.toLowerCase()).toBe("svg");
  });

  it("accepts compact variant", () => {
    const { container } = render(<Logo variant="compacta" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    expect(svg?.getAttribute("viewBox")).toBe("0 0 240 60");
  });

  it("accepts icon variant with 64x64 viewBox", () => {
    const { container } = render(<Logo variant="icone" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 64 64");
  });

  it("accepts main variant with 460x130 viewBox", () => {
    const { container } = render(<Logo variant="principal" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 460 130");
  });

  it("accepts mono-white variant", () => {
    const { container } = render(<Logo variant="mono-branco" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    const fills = Array.from(container.querySelectorAll("[fill]")).map((el) =>
      el.getAttribute("fill"),
    );
    expect(fills.every((f) => f === "#ffffff" || f === null)).toBe(true);
  });

  it("accepts mono-black variant", () => {
    const { container } = render(<Logo variant="mono-preto" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const fills = Array.from(container.querySelectorAll("[fill]")).map((el) =>
      el.getAttribute("fill"),
    );
    expect(fills.every((f) => f === "#0a0118" || f === null)).toBe(true);
  });

  it("is accessible: role=img + aria-label", () => {
    render(<Logo variant="compacta" />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("aria-label", "Red Figure");
  });

  it('icon uses "EP" aria-label (compact variant for favicons)', () => {
    render(<Logo variant="icone" />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("aria-label", "EP");
  });

  it("accepts className for customization", () => {
    const { container } = render(
      <Logo variant="compacta" className="h-10 w-auto" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("h-10");
    expect(svg?.getAttribute("class")).toContain("w-auto");
  });

  it("renders the 3 glitch layers (magenta, cyan, white) in the main variant", () => {
    const { container } = render(<Logo variant="principal" />);
    const fills = Array.from(container.querySelectorAll("text")).map((el) =>
      el.getAttribute("fill"),
    );
    expect(fills).toContain("#ff007a");
    expect(fills).toContain("#00f0ff");
    expect(fills).toContain("#ffffff");
  });
});
