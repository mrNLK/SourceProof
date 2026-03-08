import { useState, useEffect } from "react";
import { Plus, ExternalLink, Filter, Sparkles, Loader2, CheckCircle } from "lucide-react";
import type { AiFundWorkspace, AiFundPerson, ProcessStage, PersonType } from "@/types/ai-fund";
import { scoreColor, scoreLabel } from "@/lib/aifund-scoring";
import { fetchScoresForPerson } from "@/lib/ai-fund";
import { enrichPersonWithHarmonic } from "@/lib/harmonic";

interface Props {
  workspace: AiFundWorkspace;
}

const PROCESS_STAGE_LABELS: Record<ProcessStage, string> = {
  identified: "Identified",
  researched: "Researched",
  contacted: "Contacted",
  engaged: "Engaged",
  applied: "Applied",
  interviewing: "Interviewing",
  offered: "Offered",
  accepted: "Accepted",
  declined: "Declined",
  residency: "Residency",
  graduated: "Graduated",
  archived: "Archived",
};

type EnrichmentState = "idle" | "enriching" | "done" | "error";

export default function TalentPoolTab({ workspace }: Props) {
  const { people, loading, addPerson, updatePerson } = workspace;
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<PersonType | "all">("all");
  const [filterStage, setFilterStage] = useState<ProcessStage | "all">("all");
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [enrichingPeople, setEnrichingPeople] = useState<
    Record<string, EnrichmentState>
  >({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formLinkedin, setFormLinkedin] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formType, setFormType] = useState<PersonType>("fir");

  // Load latest composite scores
  useEffect(() => {
    const loadScores = async () => {
      const scoreMap: Record<string, number | null> = {};
      for (const person of people) {
        try {
          const personScores = await fetchScoresForPerson(person.id);
          scoreMap[person.id] =
            personScores.length > 0 ? personScores[0].compositeScore : null;
        } catch {
          scoreMap[person.id] = null;
        }
      }
      setScores(scoreMap);
    };
    if (people.length > 0) loadScores();
  }, [people]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    await addPerson({
      fullName: formName.trim(),
      email: formEmail.trim() || null,
      linkedinUrl: formLinkedin.trim() || null,
      currentRole: formRole.trim() || null,
      currentCompany: formCompany.trim() || null,
      personType: formType,
    });
    setFormName("");
    setFormEmail("");
    setFormLinkedin("");
    setFormRole("");
    setFormCompany("");
    setFormType("fir");
    setShowForm(false);
  };

  const handleEnrich = async (person: AiFundPerson) => {
    if (!person.linkedinUrl) return;
    setEnrichingPeople((prev) => ({ ...prev, [person.id]: "enriching" }));

    try {
      const result = await enrichPersonWithHarmonic({
        personId: person.id,
        linkedinUrl: person.linkedinUrl,
        personContext: {
          fullName: person.fullName,
          currentRole: person.currentRole,
          currentCompany: person.currentCompany,
          location: person.location,
        },
      });

      if (result.notFound) {
        setEnrichingPeople((prev) => ({ ...prev, [person.id]: "error" }));
        return;
      }

      // Update local state via workspace
      const updates: Partial<AiFundPerson> = {};
      if (result.person.harmonic_person_id) {
        updates.harmonicPersonId = result.person.harmonic_person_id;
      }
      if (result.person.harmonic_enriched_at) {
        updates.harmonicEnrichedAt = result.person.harmonic_enriched_at;
      }
      if (result.person.linkedin_url) {
        updates.linkedinUrl = result.person.linkedin_url;
      }
      // Don't call updatePerson for DB update — the Edge Function already updated the row
      // Just merge into local state
      setEnrichingPeople((prev) => ({ ...prev, [person.id]: "done" }));
    } catch (err) {
      console.error("Manual enrichment failed:", err);
      setEnrichingPeople((prev) => ({ ...prev, [person.id]: "error" }));
    }
  };

  const filtered = people.filter((p) => {
    if (filterType !== "all" && p.personType !== filterType) return false;
    if (filterStage !== "all" && p.processStage !== filterStage) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading talent pool...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Talent Pool</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {people.length} candidate{people.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Person
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as PersonType | "all")
          }
          className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
        >
          <option value="all">All Types</option>
          <option value="fir">FIR</option>
          <option value="ve">VE</option>
          <option value="both">Both</option>
        </select>
        <select
          value={filterStage}
          onChange={(e) =>
            setFilterStage(e.target.value as ProcessStage | "all")
          }
          className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground"
        >
          <option value="all">All Stages</option>
          {Object.entries(PROCESS_STAGE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Add person form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Full name *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="email"
              placeholder="Email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="url"
              placeholder="LinkedIn URL"
              value={formLinkedin}
              onChange={(e) => setFormLinkedin(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Current role"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Current company"
              value={formCompany}
              onChange={(e) => setFormCompany(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as PersonType)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="fir">FIR</option>
              <option value="ve">VE</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!formName.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Add
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

      {/* People list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            {people.length === 0
              ? "No candidates yet. Add your first person above."
              : "No matches for current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((person) => {
            const enrichState = enrichingPeople[person.id] || "idle";
            const isEnriched = !!person.harmonicEnrichedAt;

            return (
              <div
                key={person.id}
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                  {person.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {person.fullName}
                    </p>
                    {person.linkedinUrl && (
                      <a
                        href={person.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {/* Harmonic enrichment badge */}
                    {isEnriched && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full"
                        title={`Enriched via Harmonic on ${new Date(person.harmonicEnrichedAt!).toLocaleDateString()}`}
                      >
                        <CheckCircle className="w-2.5 h-2.5" />
                        Enriched
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {[person.currentRole, person.currentCompany]
                      .filter(Boolean)
                      .join(" @ ") || "No role info"}
                  </p>
                </div>

                {/* Manual Enrich button — show only if person has LinkedIn and is not yet enriched */}
                {person.linkedinUrl &&
                  !isEnriched &&
                  enrichState !== "done" && (
                    <button
                      onClick={() => handleEnrich(person)}
                      disabled={enrichState === "enriching"}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50 transition-colors shrink-0"
                      title="Enrich this person with Harmonic data"
                    >
                      {enrichState === "enriching" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {enrichState === "enriching" ? "Enriching" : "Enrich"}
                    </button>
                  )}

                {/* Post-enrich states */}
                {enrichState === "done" && !isEnriched && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                    Enriched
                  </span>
                )}
                {enrichState === "error" && (
                  <span className="text-[10px] text-destructive shrink-0">
                    Not found
                  </span>
                )}

                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase shrink-0">
                  {person.personType}
                </span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded shrink-0">
                  {PROCESS_STAGE_LABELS[person.processStage]}
                </span>
                {scores[person.id] !== undefined && (
                  <span
                    className={`text-xs font-semibold shrink-0 ${scoreColor(scores[person.id])}`}
                  >
                    {scores[person.id] !== null
                      ? `${scores[person.id]?.toFixed(1)} - ${scoreLabel(scores[person.id])}`
                      : "Unscored"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
