import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Search, GitBranch, Filter, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchDevelopers } from "@/lib/api";
import DeveloperCard from "@/components/DeveloperCard";

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(query);

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ["github-search", query],
    queryFn: () => searchDevelopers(query),
    enabled: !!query,
    staleTime: 1000 * 60 * 5,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground hidden sm:inline">SourceKit</span>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground py-2 pl-10 pr-4 outline-none border border-border focus:border-primary/40 transition-colors font-body"
              placeholder="Search engineers..."
            />
          </form>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-lg font-semibold text-foreground">
              Results for "<span className="text-primary">{query}</span>"
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Searching GitHub..." : `${results.length} engineers found · Sorted by relevance score`}
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="ml-3 text-muted-foreground font-display text-sm">Analyzing GitHub profiles...</span>
          </div>
        )}

        {error && (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-destructive font-display text-sm mb-2">Failed to search GitHub</p>
            <p className="text-muted-foreground text-xs">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="grid gap-3">
            {results.map((dev: any) => (
              <DeveloperCard key={dev.id} developer={dev} />
            ))}
            {results.length === 0 && (
              <p className="text-center text-muted-foreground py-12 font-display text-sm">No results found. Try a different query.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchResults;
