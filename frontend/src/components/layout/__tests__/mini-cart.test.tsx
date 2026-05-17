import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode, HTMLAttributes } from "react";
import { MiniCart } from "../mini-cart";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { useMiniCart } from "@/hooks/use-mini-cart";
import type { CartItem } from "@/types/cart";

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="drawer-root">{children}</div> : null,
  DrawerContent: ({ children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
    <div {...rest}>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerFooter: ({ children, ...rest }: HTMLAttributes<HTMLDivElement>) => (
    <div {...rest}>{children}</div>
  ),
}));

vi.mock("@/components/cart/free-gift-progress", () => ({
  FreeGiftProgress: () => <div data-testid="free-gift-progress" />,
}));

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi
      .fn()
      .mockResolvedValue({ data: { data: { freeShippingInfo: null } } }),
  },
}));

const mockUpdateQuantity = vi.fn();
const mockRemoveItem = vi.fn();

vi.mock("@/hooks/use-cart", () => ({
  useCart: () => ({
    items: [],
    subtotal: 0,
    itemCount: 0,
    fetchCart: vi.fn(),
    addItem: vi.fn(),
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
    clearCart: vi.fn(),
  }),
}));

const SAMPLE_ITEM: CartItem = {
  productId: "p1",
  variationId: "v1",
  variationName: "Sword",
  variationLabel: "Version",
  quantity: 2,
  price: 99.9,
  name: "Test Miniature",
  image: "https://example.com/img.jpg",
};

beforeEach(() => {
  useMiniCart.setState({ open: false });
  useCartStore.setState({ items: [], subtotal: 0, itemCount: 0 });
  useAuthStore.setState({ isAuthenticated: false } as never);
  mockUpdateQuantity.mockClear();
  mockRemoveItem.mockClear();
});

describe("MiniCart — visibility & open state", () => {
  it("DOES NOT render when drawer closed (open=false default)", () => {
    render(<MiniCart />);
    expect(screen.queryByTestId("drawer-root")).toBeNull();
  });

  it("renders when useMiniCart.openCart() called", () => {
    useMiniCart.setState({ open: true });
    render(<MiniCart />);
    expect(screen.getByTestId("drawer-root")).toBeInTheDocument();
  });

  it("REGRESSION: itemCount changing from 0 → N DOES NOT open drawer", () => {
    render(<MiniCart />);
    expect(screen.queryByTestId("drawer-root")).toBeNull();

    useCartStore.setState({
      items: [SAMPLE_ITEM],
      subtotal: 199.8,
      itemCount: 2,
    });

    expect(screen.queryByTestId("drawer-root")).toBeNull();
    expect(useMiniCart.getState().open).toBe(false);
  });
});

describe("MiniCart — empty state", () => {
  it("shows empty state when items=[]", () => {
    useMiniCart.setState({ open: true });
    render(<MiniCart />);
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });
});

describe("MiniCart — items rendering", () => {
  beforeEach(() => {
    useMiniCart.setState({ open: true });
    useCartStore.setState({
      items: [SAMPLE_ITEM],
      subtotal: 199.8,
      itemCount: 2,
    });
  });

  it("renders name + variation + quantity", () => {
    render(<MiniCart />);
    expect(screen.getByText("Test Miniature")).toBeInTheDocument();
    expect(screen.getByText(/Sword/)).toBeInTheDocument();
    expect(screen.getByTestId("mini-cart-item-qty")).toHaveTextContent("2");
  });

  it("+ button increases quantity via updateQuantity", () => {
    render(<MiniCart />);
    fireEvent.click(screen.getByLabelText("Increase quantity"));
    expect(mockUpdateQuantity).toHaveBeenCalledWith("p1", 3, "v1", undefined);
  });

  it("- button decreases quantity via updateQuantity", () => {
    render(<MiniCart />);
    fireEvent.click(screen.getByLabelText("Decrease quantity"));
    expect(mockUpdateQuantity).toHaveBeenCalledWith("p1", 1, "v1", undefined);
  });

  it("- button disabled when quantity=1", () => {
    useCartStore.setState({
      items: [{ ...SAMPLE_ITEM, quantity: 1 }],
      subtotal: 99.9,
      itemCount: 1,
    });
    render(<MiniCart />);
    expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();
  });

  it("trash can calls removeItem", () => {
    render(<MiniCart />);
    fireEvent.click(screen.getByLabelText(/Remove Test Miniature/));
    expect(mockRemoveItem).toHaveBeenCalledWith("p1", "v1", undefined);
  });
});

describe("MiniCart — bundle children", () => {
  it("renders bundle children below parent item", () => {
    useMiniCart.setState({ open: true });
    useCartStore.setState({
      items: [
        {
          ...SAMPLE_ITEM,
          name: "Bundle 3 Heroines",
          bundleChildren: [
            {
              productId: "c1",
              quantity: 1,
              unitPrice: 50,
              discountedPrice: 40,
              name: "Heroine A",
              image: "https://example.com/a.jpg",
            },
            {
              productId: "c2",
              quantity: 1,
              unitPrice: 60,
              discountedPrice: 48,
              name: "Heroine B",
              image: "https://example.com/b.jpg",
            },
          ],
        },
      ],
      subtotal: 200,
      itemCount: 1,
    });
    render(<MiniCart />);
    expect(screen.getByText("Heroine A")).toBeInTheDocument();
    expect(screen.getByText("Heroine B")).toBeInTheDocument();
  });
});

describe("MiniCart — actions footer", () => {
  beforeEach(() => {
    useMiniCart.setState({ open: true });
    useCartStore.setState({
      items: [SAMPLE_ITEM],
      subtotal: 199.8,
      itemCount: 2,
    });
  });

  it("renders 3 actions: Checkout, View Cart, Continue Shopping", () => {
    render(<MiniCart />);
    expect(
      screen.getByRole("button", { name: /checkout/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view full cart/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue shopping/i }),
    ).toBeInTheDocument();
  });

  it("Continue button closes drawer", () => {
    render(<MiniCart />);
    fireEvent.click(screen.getByRole("button", { name: /continue shopping/i }));
    expect(useMiniCart.getState().open).toBe(false);
  });
});

describe("MiniCart — FreeGiftProgress preserved", () => {
  it("renders FreeGiftProgress when there are items (preserves Phase 1 feature)", () => {
    useMiniCart.setState({ open: true });
    useCartStore.setState({
      items: [SAMPLE_ITEM],
      subtotal: 199.8,
      itemCount: 2,
    });
    render(<MiniCart />);
    expect(screen.getByTestId("free-gift-progress")).toBeInTheDocument();
  });
});
