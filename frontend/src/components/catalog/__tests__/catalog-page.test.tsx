import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CatalogPage } from "../catalog-page";
import { api } from "@/lib/api-client";

let currentSearchParams = new URLSearchParams();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => "/products",
}));

vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn() },
}));

vi.mock("@/lib/ga4-events", () => ({
  trackViewItemList: vi.fn(),
}));

const mockedApiGet = vi.mocked(api.get);

const SAMPLE_PRODUCT = {
  id: "p1",
  name: "Test Miniature",
  slug: "test-miniature",
  description: "desc",
  type: "simple",
  basePrice: 99.9,
  isActive: true,
  featured: false,
  categories: [],
  tags: [],
  images: [],
  variations: [],
  stock: 5,
  reservedStock: 0,
  manageStock: true,
  availableStock: 5,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

beforeEach(() => {
  currentSearchParams = new URLSearchParams();
  mockReplace.mockClear();
  mockedApiGet.mockReset();
});

describe("CatalogPage", () => {
  it("renders title and description", async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, perPage: 24, lastPage: 1 },
        filters: null,
      },
    });

    render(
      <CatalogPage
        title="Products"
        description="Whole collection"
        listId="all"
        listName="all"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Whole collection")).toBeInTheDocument();
  });

  it("shows empty state when API returns empty list", async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, perPage: 24, lastPage: 1 },
        filters: null,
      },
    });

    render(<CatalogPage title="Empty" listId="x" listName="x" />);
    await waitFor(() => {
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    });
  });

  it("renders products after fetch", async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: [SAMPLE_PRODUCT],
        meta: { total: 1, page: 1, perPage: 24, lastPage: 1 },
        filters: null,
      },
    });

    render(<CatalogPage title="List" listId="x" listName="x" />);
    await waitFor(() => {
      expect(screen.getByText("Test Miniature")).toBeInTheDocument();
    });
  });

  it("passes filters to API when URL has params", async () => {
    currentSearchParams = new URLSearchParams(
      "sort=sold&featured=true&onSale=true&priceMin=100",
    );
    mockedApiGet.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, perPage: 24, lastPage: 1 },
        filters: null,
      },
    });

    render(<CatalogPage title="Filtered" listId="x" listName="x" />);
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({
            sort: "sold",
            featured: "true",
            onSale: "true",
            priceMin: "100",
          }),
        }),
      );
    });
  });

  it("passes fixed categoryId via prop to API", async () => {
    mockedApiGet.mockResolvedValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, perPage: 24, lastPage: 1 },
        filters: null,
      },
    });

    render(
      <CatalogPage
        title="Category X"
        categoryId="cat-x"
        listId="cat-x"
        listName="Cat X"
      />,
    );
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({ categoryId: "cat-x" }),
        }),
      );
    });
  });

  it("shows activeChips when filter is applied", async () => {
    currentSearchParams = new URLSearchParams("onSale=true");
    mockedApiGet.mockResolvedValue({
      data: {
        data: [SAMPLE_PRODUCT],
        meta: { total: 1, page: 1, perPage: 24, lastPage: 1 },
        filters: null,
      },
    });

    render(<CatalogPage title="Promo" listId="x" listName="x" />);
    await waitFor(() => {
      expect(
        screen.getByLabelText(/remove filter: on sale/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/clear all/i)).toBeInTheDocument();
  });
});
