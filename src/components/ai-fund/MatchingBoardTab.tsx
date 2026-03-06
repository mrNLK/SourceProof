import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import type { AiFundWorkspace, AssignmentRole } from "@/types/ai-fund";

interface Props {
  workspace: AiFundWorkspace;
}

export default function MatchingBoardTab({ workspace }: Props) {
  const { concepts, people, assignments, loading, addAssignment } = workspace;
  const [showForm, setShowForm] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [selectedRole, setSelectedRole] = useState<AssignmentRole>("fir");

  const handleAssign = async () => {
    if (!selectedConcept || !selectedPerson) return;
    await addAssignment({
      conceptId: selectedConcept,
      personId: selectedPerson,
      role: selectedRole,
    });
    setSelectedConcept("");
    setSelectedPerson("");
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading matching board...</div>
      </div>
    );
  }

  // Build assignment view: concept -> assigned people
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));
  const personMap = new Map(people.map((p) => [p.id, p]));

  const assignmentsByConceptId = assignments.reduce(
    (acc, a) => {
      if (!acc[a.conceptId]) acc[a.conceptId] = [];
      acc[a.conceptId].push(a);
      return acc;
    },
    {} as Record<string, typeof assignments>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Matching Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign candidates to concepts as FIR or VE
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      {/* Assignment form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select
              value={selectedConcept}
              onChange={(e) => setSelectedConcept(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">Select concept</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">Select person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName}</option>
              ))}
            </select>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as AssignmentRole)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="fir">FIR</option>
              <option value="ve">VE</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAssign}
              disabled={!selectedConcept || !selectedPerson}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Assign
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

      {/* Matching grid */}
      {concepts.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            No concepts yet. Create one in the Concept Pipeline tab first.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {concepts.map((concept) => {
            const conceptAssignments = assignmentsByConceptId[concept.id] || [];
            return (
              <div key={concept.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{concept.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {conceptAssignments.length} assigned
                  </span>
                </div>

                {conceptAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No assignments yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {conceptAssignments.map((a) => {
                      const person = personMap.get(a.personId);
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-3 px-3 py-2 bg-background rounded-lg"
                        >
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold shrink-0">
                            {person?.fullName.charAt(0) || "?"}
                          </div>
                          <span className="text-sm text-foreground flex-1 truncate">
                            {person?.fullName || "Unknown"}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                            {a.role}
                          </span>
                          <span className="text-xs text-muted-foreground">{a.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
