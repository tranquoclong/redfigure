import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { usePathname } from "next/navigation";
import { BottomNav } from "../bottom-nav";
import { useCatalogFilterStore } from "@/store/catalog-filter-store";

const mockedPathname = vi.mocked(usePathname);

describe("BottomNav — base behavior", () => {
  beforeEach(() => {
    mockedPathname.mockReturnValue("/");
    useCatalogFilterStore.setState({ mobileFiltersOpen: false });
  });

  it("renders 4 base tabs (Home, Catalog, Wishlist, Account) outside listing", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Wishlist")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();

    expect(screen.queryByText("Search")).not.toBeInTheDocument();
  });

  it("DOES NOT render Filters button outside listing page", () => {
    render(<BottomNav />);
    expect(
      screen.queryByRole("button", { name: /filters/i }),
    ).not.toBeInTheDocument();
  });

  it('marks "Home" tab as active when pathname=/', () => {
    render(<BottomNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("aria-current", "page");
  });

  it("is fixed bottom + lg:hidden + nav role with aria-label", () => {
    render(<BottomNav />);
    const nav = screen.getByTestId("bottom-nav");
    expect(nav.className).toMatch(/fixed/);
    expect(nav.className).toMatch(/bottom-0/);
    expect(nav.className).toMatch(/lg:hidden/);
    expect(nav).toHaveAttribute("aria-label", "Main navigation");
  });
});

describe("BottomNav — Filters button on listing routes", () => {
  const LISTING_ROUTES = [
    "/products",
    "/search",
    "/c/fantasy",
    "/m/elite-pinup",
    "/t/promotion",
  ];

  beforeEach(() => {
    useCatalogFilterStore.setState({ mobileFiltersOpen: false });
  });

  for (const route of LISTING_ROUTES) {
    it(`renders Filters button on ${route}`, () => {
      mockedPathname.mockReturnValue(route);
      render(<BottomNav />);
      expect(
        screen.getByRole("button", { name: /filters/i }),
      ).toBeInTheDocument();
    });
  }

  it("clicking Filters button calls setMobileFiltersOpen(true) in store", () => {
    mockedPathname.mockReturnValue("/products");
    render(<BottomNav />);
    expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(true);
  });

  it('DOES NOT appear on /cart even if it has "/" in path', () => {
    mockedPathname.mockReturnValue("/cart");
    render(<BottomNav />);
    expect(
      screen.queryByRole("button", { name: /filters/i }),
    ).not.toBeInTheDocument();
  });

  it("DOES NOT appear on /p/[slug] (PDP — not a listing)", () => {
    mockedPathname.mockReturnValue("/p/some-product");
    render(<BottomNav />);
    expect(
      screen.queryByRole("button", { name: /filters/i }),
    ).not.toBeInTheDocument();
  });
});

describe("BottomNav — closes filter sheet on route change", () => {
  beforeEach(() => {
    useCatalogFilterStore.setState({ mobileFiltersOpen: true });
  });

  it("pathname change closes filter sheet (avoids SPA state leak)", () => {
    mockedPathname.mockReturnValue("/products");
    const { rerender } = render(<BottomNav />);
    useCatalogFilterStore.setState({ mobileFiltersOpen: true });
    expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(true);

    mockedPathname.mockReturnValue("/");
    rerender(<BottomNav />);
    expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(false);
  });

  it("navigation within the same dynamic segment (/c/a → /c/b) also closes", () => {
    mockedPathname.mockReturnValue("/c/category-a");
    const { rerender } = render(<BottomNav />);
    useCatalogFilterStore.setState({ mobileFiltersOpen: true });

    mockedPathname.mockReturnValue("/c/category-b");
    rerender(<BottomNav />);
    expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(false);
  });
});
