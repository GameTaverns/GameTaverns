import { useQuery } from "@tanstack/react-query";
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/backend/client";

interface ImportJob {
  id: string;
  library_id: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  import_type: string | null;
  created_at: string;
  updated_at: string;
}

interface ImportProgressWidgetProps {
  libraryIds: string[];
}

export function ImportProgressWidget({ libraryIds }: ImportProgressWidgetProps) {
  const { data: activeJobs = [] } = useQuery<ImportJob[]>({
    queryKey: ["my-active-imports", libraryIds],
    queryFn: async () => {
      if (libraryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .in("library_id", libraryIds)
        .eq("status", "processing")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: libraryIds.length > 0,
    refetchInterval: 3000,
  });

  const { data: recentJobs = [] } = useQuery<ImportJob[]>({
    queryKey: ["my-recent-imports", libraryIds],
    queryFn: async () => {
      if (libraryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .in("library_id", libraryIds)
        .in("status", ["completed", "failed"])
        .order("updated_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: libraryIds.length > 0,
    refetchInterval: activeJobs.length > 0 ? 5000 : false,
  });

  if (activeJobs.length === 0 && recentJobs.length === 0) return null;

  const formatType = (t: string | null) =>
    t === "bgg_collection" ? "BGG Collection" : t === "bgg_links" ? "BGG Links" : "CSV";

  return (
    <Card className="bg-wood-medium/30 border-wood-medium/50 text-cream lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4 text-secondary" />
          Import Progress
          {activeJobs.length > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
              {activeJobs.length} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeJobs.map((job) => {
          const pct = job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0;
          return (
            <div key={job.id} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-400" />
                  <span>{formatType(job.import_type)} Import</span>
                </div>
                <span className="text-cream/60 text-xs">
                  {job.processed_items}/{job.total_items} items · {job.successful_items} ok
                  {job.skipped_items > 0 && ` · ${job.skipped_items} existed`}
                  {job.failed_items > 0 && ` · ${job.failed_items} failed`}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          );
        })}

        {activeJobs.length === 0 && recentJobs.length > 0 && (
          <div className="space-y-1">
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-2">
                  {job.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className="text-cream/80">{formatType(job.import_type)}</span>
                  <span className="text-cream/50">
                    {job.successful_items}/{job.total_items} imported
                    {job.skipped_items > 0 && ` · ${job.skipped_items} existed`}
                    {job.failed_items > 0 && ` · ${job.failed_items} failed`}
                  </span>
                </div>
                <span className="text-cream/40">
                  {new Date(job.updated_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
