import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "./header";
import type { MenuItem } from "@/lib/site-content";

vi.mock("@/store/cart-store", () => {
  const state = { itemCount: 3, items: [], subtotal: 0 };
  return {
    useCartStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});
vi.mock("@/store/auth-store", () => {
  const state = { isAuthenticated: false };
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) =>
      selector ? selector(state) : state,
  };
});
vi.mock("./search-input", () => ({
  SearchInput: () => <div data-testid="search-input" />,
}));
vi.mock("./mobile-search-overlay", () => ({
  MobileSearchOverlay: () => null,
}));
vi.mock("./mini-cart", () => ({
  MiniCart: () => null,
}));
vi.mock("@/hooks/use-mini-cart", () => ({
  useMiniCart: (
    selector?: (s: { open: boolean; openCart: () => void }) => unknown,
  ) => {
    const state = { open: false, openCart: vi.fn() };
    return selector ? selector(state) : state;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const menu: MenuItem[] = [
  { label: "Home", href: "/" },
  { label: "Catalog", href: "/products" },
  { label: "Pinups", href: "/c/pinups" },
];

describe("Header (Red Figure)", () => {
  it("renders the Red Figure Logo (compact variant)", () => {
    render(<Header menu={menu} />);
    const logo = screen.getByRole("img", { name: /elite pinup/i });
    expect(logo).toBeInTheDocument();

    expect(logo.getAttribute("viewBox")).toBe("0 0 240 60");
  });

  it("renders all menu links received via props", () => {
    render(<Header menu={menu} />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Catalog" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: "Pinups" })).toHaveAttribute(
      "href",
      "/c/pinups",
    );
  });

  it("displays cart badge with itemCount", () => {
    render(<Header menu={menu} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("includes inline SearchInput", () => {
    render(<Header menu={menu} />);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("cart button has aria-label", () => {
    render(<Header menu={menu} />);
    expect(
      screen.getByRole("button", { name: /cart/i }),
    ).toBeInTheDocument();
  });

  it("account button has aria-label", () => {
    render(<Header menu={menu} />);
    expect(screen.getByRole("button", { name: /account/i })).toBeInTheDocument();
  });

  it("account link points to /login when not authenticated", () => {
    render(<Header menu={menu} />);
    const accountLink = screen
      .getByRole("button", { name: /account/i })
      .closest("a");
    expect(accountLink).toHaveAttribute("href", "/login");
  });

  it("header is sticky and has ink background", () => {
    const { container } = render(<Header menu={menu} />);
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/sticky/);
    expect(header?.className).toMatch(/bg-ink/);
  });
});
