import { Settings, Key, Globe, Bell } from "lucide-react";

export default function AiFundSettingsTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI Fund Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure integrations, API keys, and notification preferences
        </p>
      </div>

      {/* API Keys */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">API Keys</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Exa API Key</label>
            <input
              type="password"
              placeholder="exa-..."
              disabled
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Configured in main Settings tab</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">GitHub Token</label>
            <input
              type="password"
              placeholder="ghp_..."
              disabled
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-muted-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">For GitHub profile fetching</p>
          </div>
        </div>
      </div>

      {/* Sourcing Channels */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Sourcing Channels</h2>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between px-3 py-2 bg-background rounded-lg">
            <span>HuggingFace Spaces</span>
            <span className="text-xs text-primary">Active</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-background rounded-lg">
            <span>arXiv (applied AI)</span>
            <span className="text-xs text-primary">Active</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-background rounded-lg">
            <span>Conference Rosters</span>
            <span className="text-xs text-muted-foreground">Not configured</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-background rounded-lg">
            <span>YC Alumni</span>
            <span className="text-xs text-primary">Active</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-background rounded-lg">
            <span>"Built in Public" accounts</span>
            <span className="text-xs text-muted-foreground">Not configured</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Notification preferences will be available in a future update.
        </p>
      </div>
    </div>
  );
}
