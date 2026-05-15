import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./footer";
import type { FooterColumn, SocialLink } from "@/lib/site-content";

const columns: FooterColumn[] = [
  {
    title: "SHOP",
    links: [
      { label: "Catalog", href: "/products" },
      { label: "Bundles", href: "/c/bundles" },
    ],
  },
  {
    title: "HELP",
    links: [{ label: "How to buy", href: "/faq" }],
  },
];

const socials: SocialLink[] = [
  {
    platform: "instagram",
    href: "https://instagram.com/redfigure",
    shortLabel: "ig",
  },
  {
    platform: "facebook",
    href: "https://facebook.com/redfigure",
    shortLabel: "f",
  },
];

const legal = {
  copyright: "© 2026 Red Figure · redfigure.com",
  mst: "",
};

describe("Footer (Red Figure)", () => {
  it("renders compact Red Figure Logo", () => {
    render(<Footer columns={columns} socials={socials} legal={legal} />);
    const logo = screen.getByRole("img", { name: /elite pinup/i });
    expect(logo.getAttribute("viewBox")).toBe("0 0 240 60");
  });

  it("renders titles and links for each column", () => {
    render(<Footer columns={columns} socials={socials} legal={legal} />);

    expect(screen.getByText(/SHOP/)).toBeInTheDocument();
    expect(screen.getByText(/HELP/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: "Bundles" })).toHaveAttribute(
      "href",
      "/c/bundles",
    );
    expect(screen.getByRole("link", { name: "How to buy" })).toHaveAttribute(
      "href",
      "/faq",
    );
  });

  it("renders social media with platform aria-label", () => {
    render(<Footer columns={columns} socials={socials} legal={legal} />);
    const ig = screen.getByRole("link", { name: /instagram/i });
    expect(ig).toHaveAttribute("href", "https://instagram.com/redfigure");
    expect(screen.getByRole("link", { name: /facebook/i })).toBeInTheDocument();
  });

  it("displays copyright", () => {
    render(<Footer columns={columns} socials={socials} legal={legal} />);
    expect(screen.getByText(/© 2026 Red Figure/i)).toBeInTheDocument();
  });

  it("footer has dark background and top border", () => {
    const { container } = render(
      <Footer columns={columns} socials={socials} legal={legal} />,
    );
    const footer = container.querySelector("footer");
    expect(footer?.className).toMatch(/border-t/);
    expect(footer?.className).toMatch(/bg-/);
  });

  it("column title uses mono font (handoff redesign 07/05/2026)", () => {
    render(<Footer columns={columns} socials={socials} legal={legal} />);
    const title = screen.getByText(/SHOP/);
    expect(title.className).toMatch(/font-mono|font-jetbrains-mono/);
  });
});
