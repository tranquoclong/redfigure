import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentlyViewedSection } from "./recently-viewed-section";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/hooks/use-recently-viewed", () => ({
  useRecentlyViewed: vi.fn(),
}));

vi.mock("@/store/auth-store", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("./product-card", () => ({
  ProductCard: ({ product }: { product: { id: string; name: string } }) => (
    <div data-testid={`product-card-${product.id}`}>{product.name}</div>
  ),
}));

import { usePathname } from "next/navigation";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { useAuthStore } from "@/store/auth-store";

const mockedPathname = vi.mocked(usePathname);
const mockedHook = vi.mocked(useRecentlyViewed);
const mockedAuth = vi.mocked(useAuthStore);

function makeProducts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Product ${i + 1}`,
  }));
}

describe("RecentlyViewedSection — visibility by route", () => {
  beforeEach(() => {
    mockedHook.mockReset();
    mockedPathname.mockReset();
    mockedAuth.mockReset();
    mockedAuth.mockReturnValue(false);
  });

  it("renders on /cart (no longer hidden)", () => {
    mockedPathname.mockReturnValue("/cart");
    mockedHook.mockReturnValue({
      data: makeProducts(2),
      isLoading: false,
    } as ReturnType<typeof useRecentlyViewed>);

    render(<RecentlyViewedSection />);

    expect(screen.getByText(/Recently viewed/i)).toBeInTheDocument();
  });

  it("remains hidden on /checkout (focused flow)", () => {
    mockedPathname.mockReturnValue("/checkout");
    mockedHook.mockReturnValue({
      data: makeProducts(2),
      isLoading: false,
    } as ReturnType<typeof useRecentlyViewed>);

    const { container } = render(<RecentlyViewedSection />);
    expect(container.firstChild).toBeNull();
  });

  it("remains hidden on /order/* (confirmation/payment)", () => {
    mockedPathname.mockReturnValue("/order/confirmation/abc");
    mockedHook.mockReturnValue({
      data: makeProducts(2),
      isLoading: false,
    } as ReturnType<typeof useRecentlyViewed>);

    const { container } = render(<RecentlyViewedSection />);
    expect(container.firstChild).toBeNull();
  });
});
