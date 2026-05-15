import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TopBar } from "./top-bar";
import type { TopBarMessage } from "@/lib/site-content";

const messages: TopBarMessage[] = [
  { text: "+18 · Adult content", align: "left" },
  { text: "Free shipping over 299,000 VND", align: "right" },
  { text: "QR -10% · Invoice -5%", align: "right" },
];

describe("TopBar (marquee redesign)", () => {
  it("renders messages (duplicated for marquee loop)", () => {
    const { container } = render(<TopBar messages={messages} />);

    expect(container.textContent).toContain("Adult content");
    expect(container.textContent).toContain("Free shipping");
    expect(container.textContent).toContain("QR");
  });

  it("container has dark bg + border + uppercase", () => {
    const { container } = render(<TopBar messages={messages} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toMatch(/uppercase/);

    expect(bar.className).toMatch(/font-sans/);
    expect(bar.className).toMatch(/border-b/);
  });

  it("marquee has animation class for scroll loop", () => {
    const { container } = render(<TopBar messages={messages} />);
    const marquee = container.querySelector(".animate-marquee");
    expect(marquee).not.toBeNull();
  });

  it("omits rendering if messages empty", () => {
    const { container } = render(<TopBar messages={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("parsing **bold** turns magenta", () => {
    const { container } = render(
      <TopBar messages={[{ text: "**+18** Content", align: "left" }]} />,
    );
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("+18");
    expect(strong?.className).toMatch(/text-magenta/);
  });

  it("parsing ~cyan~ turns cyan", () => {
    const { container } = render(
      <TopBar messages={[{ text: "~QR~ -10%", align: "left" }]} />,
    );

    const cyan = Array.from(container.querySelectorAll("span")).find((el) =>
      el.className.includes("text-cyan"),
    );
    expect(cyan).toBeDefined();
  });
});
