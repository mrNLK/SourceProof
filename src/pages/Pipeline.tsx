import { Link } from "react-router-dom";
import { GitBranch, GripVertical, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STAGES = [
  { id: 'sourced', label: 'Sourced', color: 'bg-primary/15 text-primary border-primary/30' },
  { id: 'contacted', label: 'Contacted', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'responded', label: 'Responded', color: 'bg-info/15 text-info border-info/30' },
  { id: 'screen', label: 'Screen', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'offer', label: 'Offer', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
] as const;

const Pipeline = () => {
  const queryClient = useQueryClient();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pipeline').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from('pipeline').update({ stage }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
  });

  const handleDrop = (stageId: string) => {
    if (draggedItem) {
      moveMutation.mutate({ id: draggedItem, stage: stageId });
      setDraggedItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">SourceKit</span>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            <Link to="/" className="text-xs font-display px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">Search</Link>
            <span className="text-xs font-display px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">Pipeline</span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="font-display text-lg font-semibold text-foreground mb-6">Candidate Pipeline</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {STAGES.map((stage) => {
              const items = candidates.filter((c: any) => c.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  className="glass rounded-xl p-3 min-h-[400px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(stage.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-display font-semibold px-2 py-1 rounded-md border ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span className="text-xs font-display text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((c: any) => (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDraggedItem(c.id)}
                        className="glass rounded-lg p-3 cursor-grab active:cursor-grabbing hover:glow-border transition-all group"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          {c.avatar_url && (
                            <img src={c.avatar_url} alt="" className="w-7 h-7 rounded-md bg-secondary border border-border shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/developer/${c.github_username}`}
                              className="font-display text-xs font-semibold text-foreground hover:text-primary transition-colors truncate block"
                            >
                              {c.name || c.github_username}
                            </Link>
                            <p className="text-[10px] text-muted-foreground font-display truncate">@{c.github_username}</p>
                          </div>
                          <button
                            onClick={() => removeMutation.mutate(c.id)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Pipeline;
