import { useState, useCallback } from "react";
import DashboardLayout, { type ActiveTab } from "@/components/DashboardLayout";
import SearchTab from "@/components/SearchTab";
import PipelineTab from "@/components/PipelineTab";
import HistoryTab from "@/components/HistoryTab";
import WatchlistTab from "@/components/WatchlistTab";
import BulkActionsTab from "@/components/BulkActionsTab";
import SettingsTab from "@/components/SettingsTab";
import ResearchTab, { type ResearchState } from "@/components/ResearchTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("research");
  const [rerunQuery, setRerunQuery] = useState<string | undefined>();
  const [rerunExpanded, setRerunExpanded] = useState<string | undefined>();
  const [rerunKey, setRerunKey] = useState(0);

  // Research tab state (lifted here so it persists across tab switches)
  const [researchState, setResearchState] = useState<ResearchState>({
    jobTitle: "",
    companyName: "",
    research: "",
    error: "",
  });

  const handleRerun = useCallback((query: string, expandedQuery?: string) => {
    if (!query) {
      setActiveTab("search");
      return;
    }
    setRerunQuery(query);
    setRerunExpanded(expandedQuery);
    setRerunKey((k) => k + 1);
    setActiveTab("search");
  }, []);

  const handleSearchWithStrategy = useCallback((query: string, expandedQuery: string) => {
    setRerunQuery(query);
    setRerunExpanded(expandedQuery);
    setRerunKey((k) => k + 1);
    setActiveTab("search");
  }, []);

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "search" && (
        <SearchTab
          key={rerunKey}
          initialQuery={rerunQuery}
          initialExpandedQuery={rerunExpanded}
          autoSubmit={!!rerunQuery && rerunKey > 0}
          onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
        />
      )}
      {activeTab === "research" && (
        <ResearchTab
          state={researchState}
          onStateChange={setResearchState}
          onSearchWithStrategy={handleSearchWithStrategy}
        />
      )}
      {activeTab === "history" && <HistoryTab onRerun={handleRerun} />}
      {activeTab === "pipeline" && <PipelineTab onNavigateToSearch={() => setActiveTab("search")} />}
      {activeTab === "watchlist" && <WatchlistTab onNavigateToSearch={() => setActiveTab("search")} />}
      {activeTab === "bulk" && <BulkActionsTab />}
      {activeTab === "settings" && <SettingsTab />}
    </DashboardLayout>
  );
};

export default Index;
