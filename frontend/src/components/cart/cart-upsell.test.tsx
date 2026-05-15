import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CartUpsell } from "./cart-upsell";

vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api-client";

const mockedGet = vi.mocked(api.get);

describe("CartUpsell — suggested products price", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("variable product (basePrice=0) renders backend-computed displayPrice, not 0VND", async () => {
    // Regression: variable product pricing has basePrice=0 by design
    // (variation uses salePrice ?? price). Backend keeps Product.displayPrice
    // = min(...variation prices) synchronized. Component MUST read displayPrice.
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            id: "p1",
            slug: "study-bust-ii",
            name: "Study Bust II",
            basePrice: 0,
            salePrice: null,
            displayPrice: 89.9,
            brand: { name: "Torrida Minis" },
            images: [],
          },
        ],
      },
    });

    render(<CartUpsell excludeIds={[]} brandIds={["brand-1"]} />);

    await waitFor(() => {
      expect(screen.getByText(/Study Bust II/)).toBeInTheDocument();
    });
    expect(screen.getByText(/89000VND/)).toBeInTheDocument();
    expect(screen.queryByText(/0000VND/)).not.toBeInTheDocument();
  });

  it("simple product without promotion renders displayPrice (= basePrice)", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            id: "p2",
            slug: "simples",
            name: "Simple",
            basePrice: 50,
            salePrice: null,
            displayPrice: 50,
            brand: { name: "X" },
            images: [],
          },
        ],
      },
    });

    render(<CartUpsell excludeIds={[]} brandIds={["brand-1"]} />);

    await waitFor(() => {
      expect(screen.getByText(/R\$ 50,00/)).toBeInTheDocument();
    });
  });

  it("product on sale renders displayPrice (= salePrice)", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          {
            id: "p3",
            slug: "promo",
            name: "Promo",
            basePrice: 100,
            salePrice: 70,
            displayPrice: 70,
            brand: { name: "X" },
            images: [],
          },
        ],
      },
    });

    render(<CartUpsell excludeIds={[]} brandIds={["brand-1"]} />);

    await waitFor(() => {
      expect(screen.getByText(/R\$ 70,00/)).toBeInTheDocument();
    });
  });
});
