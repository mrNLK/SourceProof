import { useState, useEffect } from "react";
import { Mail, Send, MessageSquare } from "lucide-react";
import type { AiFundWorkspace, AiFundEngagement, EngagementChannel } from "@/types/ai-fund";
import { fetchEngagements, createEngagement } from "@/lib/ai-fund";

interface Props {
  workspace: AiFundWorkspace;
}

export default function EngagementInboxTab({ workspace }: Props) {
  const { people, loading: workspaceLoading } = workspace;
  const [engagements, setEngagements] = useState<AiFundEngagement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formPerson, setFormPerson] = useState("");
  const [formChannel, setFormChannel] = useState<EngagementChannel>("email");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const all: AiFundEngagement[] = [];
      for (const person of people) {
        try {
          const e = await fetchEngagements(person.id);
          all.push(...e);
        } catch { /* skip */ }
      }
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEngagements(all);
      setLoading(false);
    };
    if (people.length > 0) loadAll();
  }, [people]);

  const handleSend = async () => {
    if (!formPerson || !formBody.trim()) return;
    const eng = await createEngagement({
      personId: formPerson,
      channel: formChannel,
      direction: "outbound",
      subject: formSubject.trim() || null,
      body: formBody.trim(),
      sentAt: new Date().toISOString(),
    });
    setEngagements((prev) => [eng, ...prev]);
    setFormPerson("");
    setFormSubject("");
    setFormBody("");
    setShowForm(false);
  };

  const personMap = new Map(people.map((p) => [p.id, p]));
  const filtered = selectedPerson
    ? engagements.filter((e) => e.personId === selectedPerson)
    : engagements;

  if (workspaceLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading engagements...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Engagement Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {engagements.length} engagement{engagements.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
          Log Engagement
        </button>
      </div>

      {/* Filter by person */}
      <div className="flex items-center gap-3">
        <select
          value={selectedPerson || ""}
          onChange={(e) => setSelectedPerson(e.target.value || null)}
          className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
        >
          <option value="">All People</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.fullName}</option>
          ))}
        </select>
      </div>

      {/* Log engagement form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={formPerson}
              onChange={(e) => setFormPerson(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">Select person *</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </select>
            <select
              value={formChannel}
              onChange={(e) => setFormChannel(e.target.value as EngagementChannel)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
              <option value="referral">Referral</option>
              <option value="event">Event</option>
              <option value="inbound">Inbound</option>
              <option value="other">Other</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Subject"
            value={formSubject}
            onChange={(e) => setFormSubject(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea
            placeholder="Message body *"
            value={formBody}
            onChange={(e) => setFormBody(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={!formPerson || !formBody.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Log
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Engagement list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">No engagements yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((eng) => {
            const person = personMap.get(eng.personId);
            return (
              <div
                key={eng.id}
                className="flex items-start gap-3 px-4 py-3 bg-card border border-border rounded-lg"
              >
                {eng.direction === "outbound" ? (
                  <Send className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                ) : (
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {person?.fullName || "Unknown"}
                    </span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">
                      {eng.channel}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {eng.direction}
                    </span>
                  </div>
                  {eng.subject && (
                    <p className="text-xs text-foreground mt-0.5">{eng.subject}</p>
                  )}
                  {eng.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{eng.body}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(eng.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
