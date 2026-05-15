import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Product } from "@/types/product";
import { ProductCard } from "./product-card";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
  }: {
    src: string;
    alt: string;
    className?: string;
  }) => <img src={src} alt={alt} className={className} />,
}));

vi.mock("./wishlist-button", () => ({
  WishlistButton: ({ className }: { className?: string }) => (
    <button data-testid="wishlist" className={className}>
      Heart
    </button>
  ),
}));

const baseProduct: Product = {
  id: "p1",
  name: "Aurora Cyber Vixen",
  slug: "aurora-cyber-vixen",
  description: "Pinup neon premium",
  shortDescription: "Pinup neon",
  basePrice: 289,
  isActive: true,
  featured: true,
  type: "simple",
  manageStock: false,
  tags: [],
  images: [
    {
      id: "img1",
      order: 0,
      isMain: true,
      url: "https://cdn.redfigure.com/p1.webp",
      altText: "Aurora",
      mediaFile: {
        id: "m1",
        card: "https://cdn.redfigure.com/p1-card.webp",
        alt: "Aurora",
      },
    },
  ],
  variations: [],
  category: { id: "c1", name: "Pinups", slug: "pinups" },
} as unknown as Product;

describe("ProductCard (Red Figure)", () => {
  it("renders name and category", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Aurora Cyber Vixen")).toBeInTheDocument();
    expect(screen.getByText("Pinups")).toBeInTheDocument();
  });

  it("renders price formatted in VND", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText(/VND\s?289/)).toBeInTheDocument();
  });

  it('displays "FEATURED" badge when featured', () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText(/featured/i)).toBeInTheDocument();
  });

  it("renders main image with alt", () => {
    render(<ProductCard product={baseProduct} />);
    const img = screen.getByAltText("Aurora") as HTMLImageElement;
    expect(img.src).toContain("p1-card.webp");
  });

  it("includes WishlistButton", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByTestId("wishlist")).toBeInTheDocument();
  });

  it("link points to product route", () => {
    render(<ProductCard product={baseProduct} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/p/aurora-cyber-vixen");
  });

  it("applies visual identity classes (purple border, cyan hover)", () => {
    const { container } = render(<ProductCard product={baseProduct} />);
    const card = container.querySelector("a");
    expect(card?.className).toMatch(/border/);

    expect(card?.className).toMatch(/hover:/);
  });

  it("product with salePrice shows struck-through old price", () => {
    const onSale = {
      ...baseProduct,
      basePrice: 359,
      salePrice: 289,
    } as Product;
    render(<ProductCard product={onSale} />);
    expect(screen.getByText(/R\$\s?359/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?289/)).toBeInTheDocument();
  });

  it("variable product shows minimum price inside floating tag", () => {
    const variable = {
      ...baseProduct,
      type: "variable",
      basePrice: 0,
      variations: [
        { id: "v1", price: 20, salePrice: null, manageStock: false },
        { id: "v2", price: 20, salePrice: null, manageStock: false },
      ],
    } as unknown as Product;
    const { container } = render(<ProductCard product={variable} />);

    const tag = container.querySelector(".bg-gradient-to-br.from-purple");
    expect(tag).not.toBeNull();
    expect(tag?.textContent).toMatch(/R\$\s?20/);
  });

  it('variable product with range shows minimum price + "+" suffix', () => {
    const variable = {
      ...baseProduct,
      type: "variable",
      basePrice: 0,
      variations: [
        { id: "v1", price: 20, salePrice: null, manageStock: false },
        { id: "v2", price: 35, salePrice: null, manageStock: false },
      ],
    } as unknown as Product;
    const { container } = render(<ProductCard product={variable} />);
    const tag = container.querySelector(".bg-gradient-to-br.from-purple");
    expect(tag?.textContent).toMatch(/R\$\s?20/);
    expect(tag?.textContent).toContain("+");
  });

  it("simple product DOES NOT show variation counter even if array has stale data", () => {
    const simpleWithStale = {
      ...baseProduct,
      type: "simple",
      basePrice: 49.9,
      variations: [
        { id: "v1", price: 49.9 },
        { id: "v2", price: 57.39 },
      ],
    } as unknown as Product;
    render(<ProductCard product={simpleWithStale} />);
    expect(screen.queryByText(/variation/i)).toBeNull();
  });
});
