import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api-client";
import { useRecentlyViewed } from "./use-recently-viewed";

const mockedGet = vi.mocked(api.get);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useRecentlyViewed", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("limits to 4 items even when backend returns more", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: Array.from({ length: 10 }, (_, i) => ({
          id: `p${i + 1}`,
          slug: `slug-${i + 1}`,
          name: `Product ${i + 1}`,
        })),
      },
    });

    const { result } = renderHook(() => useRecentlyViewed(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toHaveLength(4);
    expect(result.current.data?.map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
  });

  it("passes through when backend returns fewer than 4", async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: "p1", slug: "s1", name: "P1" },
          { id: "p2", slug: "s2", name: "P2" },
        ],
      },
    });

    const { result } = renderHook(() => useRecentlyViewed(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toHaveLength(2);
  });
});
