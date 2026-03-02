import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const DOCS_URL = "https://sourcekit-docs.netlify.app";

const GuideTab = () => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
      <h2 className="text-sm font-semibold text-foreground tracking-tight">
        Guide
      </h2>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => window.open(DOCS_URL, "_blank")}
      >
        Open in new tab
        <ExternalLink className="w-3 h-3" />
      </Button>
    </div>
    <iframe
      src={DOCS_URL}
      title="SourceKit Documentation"
      className="flex-1 w-full border-0"
      style={{ minHeight: "calc(100vh - 120px)" }}
      allow="fullscreen"
    />
  </div>
);

export default GuideTab;
