import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDeleteFn = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: mockSelect,
      insert: mockInsert,
      delete: () => ({ eq: mockEq }),
    })),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import { useSavedSearches, type SavedSearch } from "../useSavedSearches";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

const SAMPLE_SEARCHES: SavedSearch[] = [
  {
    id: "s1",
    name: "React devs",
    query: "React developers in SF",
    expanded_query: "React developers in San Francisco",
    filters: {},
    created_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "s2",
    name: "Rust engineers",
    query: "Rust systems engineers",
    expanded_query: null,
    filters: null,
    created_at: "2026-02-02T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSavedSearches", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: select returns sample data
    mockOrder.mockResolvedValue({ data: SAMPLE_SEARCHES });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockEq.mockResolvedValue({ data: null, error: null });
  });

  it("loads saved searches on mount", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));
    expect(result.current.savedSearches[0].query).toBe("React developers in SF");
  });

  it("isSaved returns true for an existing query", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));
    expect(result.current.isSaved("React developers in SF")).toBe(true);
    expect(result.current.isSaved("Rust systems engineers")).toBe(true);
  });

  it("isSaved returns false for a non-existent query", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));
    expect(result.current.isSaved("Go developers")).toBe(false);
  });

  it("isSaved returns false for empty string", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));
    expect(result.current.isSaved("")).toBe(false);
    expect(result.current.isSaved("   ")).toBe(false);
  });

  it("saveSearch inserts a new search when not already saved", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));

    await act(async () => {
      await result.current.saveSearch("Go developers", "Go developers in US", {});
    });

    expect(mockInsert).toHaveBeenCalledWith({
      name: "Go developers",
      query: "Go developers",
      expanded_query: "Go developers in US",
      filters: {},
    });
    expect(toast).toHaveBeenCalledWith({ title: "Search bookmarked" });
  });

  it("saveSearch toggles off (deletes) when already saved", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));

    await act(async () => {
      await result.current.saveSearch("React developers in SF", "", {});
    });

    // Should call delete with the existing id
    expect(mockEq).toHaveBeenCalledWith("id", "s1");
    expect(toast).toHaveBeenCalledWith({ title: "Search removed from bookmarks" });
    // Should NOT insert
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("saveSearch does nothing for empty query", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));

    await act(async () => {
      await result.current.saveSearch("", "", {});
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockEq).not.toHaveBeenCalled();
  });

  it("deleteSearch removes a search by id", async () => {
    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toHaveLength(2));

    await act(async () => {
      await result.current.deleteSearch("s2");
    });

    expect(mockEq).toHaveBeenCalledWith("id", "s2");
  });

  it("returns empty array when no saved searches exist", async () => {
    mockOrder.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toEqual([]));
    expect(result.current.isSaved("anything")).toBe(false);
  });

  it("returns empty array when supabase returns null data", async () => {
    mockOrder.mockResolvedValue({ data: null });

    const { result } = renderHook(() => useSavedSearches(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.savedSearches).toEqual([]));
  });
});
