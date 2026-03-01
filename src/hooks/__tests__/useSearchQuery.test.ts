import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks — must be defined before importing the hook
// ---------------------------------------------------------------------------

// Mock api module
vi.mock("@/lib/api", () => ({
  searchDevelopers: vi.fn(),
  searchDevelopersStreaming: vi.fn(),
  loadSearchResults: vi.fn(),
}));

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

import { useSearchQuery, type UseSearchQueryOptions } from "../useSearchQuery";
import {
  searchDevelopersStreaming,
  loadSearchResults,
} from "@/lib/api";
import type { Developer } from "@/types/developer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDev(overrides: Partial<Developer> & { username: string }): Developer {
  return {
    id: overrides.username,
    name: overrides.name ?? overrides.username,
    avatarUrl: "",
    bio: "",
    location: "",
    totalContributions: 0,
    publicRepos: 0,
    followers: 0,
    stars: 0,
    topLanguages: [],
    highlights: [],
    score: 50,
    hiddenGem: false,
    joinedYear: 2018,
    ...overrides,
  };
}

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

const defaultOpts: UseSearchQueryOptions = {
  activeQuery: "",
  activeSearchId: undefined,
  activeStrategy: undefined,
  showUngettable: false,
  query: "",
  expandedQuery: "",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSearchQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty results when no activeQuery", () => {
    const { result } = renderHook(
      () => useSearchQuery({ ...defaultOpts, activeQuery: "" }),
      { wrapper: createWrapper() },
    );

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isHistoryReplay).toBe(false);
  });

  it("deduplicates results by username (case-insensitive)", async () => {
    const mockResults = [
      makeDev({ username: "alice" }),
      makeDev({ username: "Alice" }),
      makeDev({ username: "bob" }),
      makeDev({ username: "BOB" }),
      makeDev({ username: "charlie" }),
    ];

    (searchDevelopersStreaming as Mock).mockResolvedValue({
      results: mockResults,
      reposSearched: [],
      parsedCriteria: { skills: [], location: null, seniority: null },
    });

    const { result } = renderHook(
      () => useSearchQuery({ ...defaultOpts, activeQuery: "test search" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should only keep first occurrence of each username (case-insensitive)
    const usernames = result.current.results.map((d) => d.username);
    expect(usernames).toHaveLength(3);
    expect(usernames).toContain("alice");
    expect(usernames).toContain("bob");
    expect(usernames).toContain("charlie");
  });

  it("filters bot accounts from results", async () => {
    const mockResults = [
      makeDev({ username: "real-user" }),
      makeDev({ username: "dependabot" }),
      makeDev({ username: "renovate-bot" }),
      makeDev({ username: "github-actions" }),
      makeDev({ username: "another-real-user" }),
      makeDev({ username: "deploy-bot" }),
      makeDev({ username: "my-codecov-helper" }),
    ];

    (searchDevelopersStreaming as Mock).mockResolvedValue({
      results: mockResults,
      reposSearched: [],
      parsedCriteria: { skills: [], location: null, seniority: null },
    });

    const { result } = renderHook(
      () => useSearchQuery({ ...defaultOpts, activeQuery: "test bots" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const usernames = result.current.results.map((d) => d.username);
    expect(usernames).toContain("real-user");
    expect(usernames).toContain("another-real-user");
    expect(usernames).not.toContain("dependabot");
    expect(usernames).not.toContain("renovate-bot");
    expect(usernames).not.toContain("github-actions");
    expect(usernames).not.toContain("deploy-bot");
  });

  it("reports isHistoryReplay when activeSearchId is set", async () => {
    (loadSearchResults as Mock).mockResolvedValue({
      results: [makeDev({ username: "cached-user" })],
      reposSearched: [],
      parsedCriteria: { skills: [], location: null, seniority: null },
    });

    const { result } = renderHook(
      () =>
        useSearchQuery({
          ...defaultOpts,
          activeSearchId: "search-123",
          activeQuery: "cached query",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isHistoryReplay).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].username).toBe("cached-user");
  });

  it("sets isRateLimited when error is RATE_LIMITED", async () => {
    const rateLimitError = new Error("RATE_LIMITED");
    (searchDevelopersStreaming as Mock).mockRejectedValue(rateLimitError);

    const { result } = renderHook(
      () => useSearchQuery({ ...defaultOpts, activeQuery: "rate-limited" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isRateLimited).toBe(true));
    expect(result.current.rateLimitCountdown).toBeGreaterThan(0);
  });

  it("exposes parsedCriteria and reposSearched from response", async () => {
    (searchDevelopersStreaming as Mock).mockResolvedValue({
      results: [makeDev({ username: "alice" })],
      reposSearched: ["org/repo-a", "org/repo-b"],
      parsedCriteria: { skills: ["React", "TypeScript"], location: "US", seniority: "senior" },
    });

    const { result } = renderHook(
      () => useSearchQuery({ ...defaultOpts, activeQuery: "react devs" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reposSearched).toEqual(["org/repo-a", "org/repo-b"]);
    expect(result.current.parsedCriteria?.skills).toEqual(["React", "TypeScript"]);
    expect(result.current.parsedCriteria?.location).toBe("US");
  });

  it("does not load anything when both activeQuery and activeSearchId are empty", () => {
    const { result } = renderHook(
      () =>
        useSearchQuery({
          ...defaultOpts,
          activeQuery: "",
          activeSearchId: undefined,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(searchDevelopersStreaming).not.toHaveBeenCalled();
    expect(loadSearchResults).not.toHaveBeenCalled();
  });
});
