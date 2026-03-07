/**
 * useAiFundWorkspace Hook
 *
 * Central state management for the AI Fund module.
 * Connects to Supabase. No mock data.
 */

import { useState, useEffect, useCallback } from "react";
import {
  type AiFundConcept,
  type AiFundPerson,
  type AiFundAssignment,
  type AiFundEvaluationScore,
  type AiFundDashboardStats,
  type AiFundWorkspace,
} from "@/types/ai-fund";
import {
  fetchConcepts,
  createConcept,
  updateConcept as updateConceptDb,
  fetchPeople,
  createPerson,
  updatePerson as updatePersonDb,
  fetchAssignments,
  createAssignment,
  createScore,
  fetchDashboardStats,
} from "@/lib/ai-fund";
import { enrichPersonWithHarmonic } from "@/lib/harmonic";

export function useAiFundWorkspace(): AiFundWorkspace {
  const [concepts, setConcepts] = useState<AiFundConcept[]>([]);
  const [people, setPeople] = useState<AiFundPerson[]>([]);
  const [assignments, setAssignments] = useState<AiFundAssignment[]>([]);
  const [stats, setStats] = useState<AiFundDashboardStats>({
    totalConcepts: 0,
    activeConcepts: 0,
    totalPeople: 0,
    activePipeline: 0,
    activeResidencies: 0,
    pendingDecisions: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [c, p, a, s] = await Promise.all([
        fetchConcepts(),
        fetchPeople(),
        fetchAssignments(),
        fetchDashboardStats(),
      ]);
      setConcepts(c);
      setPeople(p);
      setAssignments(a);
      setStats(s);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load AI Fund data";
      setError(msg);
      console.error("useAiFundWorkspace refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addConcept = useCallback(
    async (fields: Partial<AiFundConcept>): Promise<AiFundConcept | null> => {
      try {
        const concept = await createConcept(fields);
        setConcepts((prev) => [concept, ...prev]);
        return concept;
      } catch (err) {
        console.error("addConcept error:", err);
        return null;
      }
    },
    []
  );

  const updateConceptHandler = useCallback(
    async (id: string, updates: Partial<AiFundConcept>): Promise<void> => {
      await updateConceptDb(id, updates);
      setConcepts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const addPerson = useCallback(
    async (fields: Partial<AiFundPerson>): Promise<AiFundPerson | null> => {
      try {
        const person = await createPerson(fields);
        setPeople((prev) => [person, ...prev]);

        // Auto-enrich with Harmonic if LinkedIn URL is available
        if (person.linkedinUrl) {
          enrichPersonWithHarmonic({
            personId: person.id,
            linkedinUrl: person.linkedinUrl,
            personContext: {
              fullName: person.fullName,
              currentRole: person.currentRole,
              currentCompany: person.currentCompany,
              location: person.location,
            },
          })
            .then((result) => {
              // Merge enriched fields into local state
              setPeople((prev) =>
                prev.map((p) =>
                  p.id === person.id
                    ? {
                        ...p,
                        harmonicPersonId: result.person.harmonic_person_id ?? p.harmonicPersonId,
                        harmonicEnrichedAt: result.person.harmonic_enriched_at ?? p.harmonicEnrichedAt,
                        linkedinUrl: result.person.linkedin_url ?? p.linkedinUrl,
                      }
                    : p
                )
              );
            })
            .catch((err) => {
              console.warn("Harmonic enrichment failed (non-blocking):", err);
            });
        }

        return person;
      } catch (err) {
        console.error("addPerson error:", err);
        return null;
      }
    },
    []
  );

  const updatePersonHandler = useCallback(
    async (id: string, updates: Partial<AiFundPerson>): Promise<void> => {
      await updatePersonDb(id, updates);
      setPeople((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );

      // Auto-enrich with Harmonic if LinkedIn URL was added/changed
      if (updates.linkedinUrl) {
        const person = people.find((p) => p.id === id);
        const merged = person ? { ...person, ...updates } : updates;
        enrichPersonWithHarmonic({
          personId: id,
          linkedinUrl: updates.linkedinUrl,
          personContext: {
            fullName: merged.fullName ?? null,
            currentRole: merged.currentRole ?? null,
            currentCompany: merged.currentCompany ?? null,
            location: merged.location ?? null,
          },
        })
          .then((result) => {
            setPeople((prev) =>
              prev.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      harmonicPersonId: result.person.harmonic_person_id ?? p.harmonicPersonId,
                      harmonicEnrichedAt: result.person.harmonic_enriched_at ?? p.harmonicEnrichedAt,
                      linkedinUrl: result.person.linkedin_url ?? p.linkedinUrl,
                    }
                  : p
              )
            );
          })
          .catch((err) => {
            console.warn("Harmonic enrichment failed (non-blocking):", err);
          });
      }
    },
    [people]
  );

  const addAssignmentHandler = useCallback(
    async (fields: Partial<AiFundAssignment>): Promise<void> => {
      const assignment = await createAssignment(fields);
      setAssignments((prev) => [assignment, ...prev]);
    },
    []
  );

  const scoreCandidateHandler = useCallback(
    async (fields: Partial<AiFundEvaluationScore>): Promise<void> => {
      await createScore(fields);
    },
    []
  );

  return {
    concepts,
    people,
    assignments,
    stats,
    loading,
    error,
    refresh,
    addConcept,
    updateConcept: updateConceptHandler,
    addPerson,
    updatePerson: updatePersonHandler,
    addAssignment: addAssignmentHandler,
    scoreCandidate: scoreCandidateHandler,
  };
}
