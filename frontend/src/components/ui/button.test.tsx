import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button (Red Figure variants)", () => {
  it("renders default variant with bg-purple", () => {
    render(<Button variant="default">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toMatch(/bg-purple/);
  });

  it("neon variant applies magenta-purple gradient + glow + orbitron", () => {
    render(<Button variant="neon">Buy</Button>);
    const btn = screen.getByRole("button", { name: "Buy" });

    expect(btn.className).toMatch(/from-magenta/);
    expect(btn.className).toMatch(/to-purple/);

    expect(btn.className).toMatch(/shadow/);

    expect(btn.className).toMatch(/\[font-family:var\(--font-orbitron\)\]/);

    expect(btn.className).toMatch(/uppercase/);
    expect(btn.className).toMatch(/tracking/);
  });

  it("ghost-neon variant has translucent white border", () => {
    render(<Button variant="ghost-neon">Learn more</Button>);
    const btn = screen.getByRole("button", { name: "Learn more" });
    expect(btn.className).toMatch(/border/);
    expect(btn.className).toMatch(/\[font-family:var\(--font-orbitron\)\]/);
  });

  it("accepts size lg for hero buttons", () => {
    render(
      <Button variant="neon" size="lg">
        Explore
      </Button>,
    );
    expect(
      screen.getByRole("button", { name: "Explore" }),
    ).toBeInTheDocument();
  });

  it("maintains other existing variants (outline, ghost, link, secondary, destructive)", () => {
    const variants = [
      "outline",
      "ghost",
      "link",
      "secondary",
      "destructive",
    ] as const;
    for (const v of variants) {
      const { unmount } = render(<Button variant={v}>{v}</Button>);
      expect(screen.getByRole("button", { name: v })).toBeInTheDocument();
      unmount();
    }
  });
});
