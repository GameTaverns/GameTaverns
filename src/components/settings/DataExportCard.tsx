import { useState } from "react";
import { Download, Loader2, FileJson, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function DataExportCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');

      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gametaverns-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExport(new Date().toLocaleString());
      toast({
        title: "Export complete",
        description: "Your data has been downloaded as a JSON file.",
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error.message || "Could not export your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Data Export
        </CardTitle>
        <CardDescription>
          Download a complete copy of all your data stored on GameTaverns. This includes your profile, 
          libraries, games, messages, activity history, achievements, and more.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Your export will include:</p>
          <ul className="list-disc pl-6 space-y-1 text-xs">
            <li>Profile information & settings</li>
            <li>All libraries and games you own</li>
            <li>Purchase prices & private admin data</li>
            <li>Loan history (as lender & borrower)</li>
            <li>Forum threads & replies</li>
            <li>Direct messages</li>
            <li>Activity feed & achievements</li>
            <li>Curated lists, ELO ratings, referrals</li>
            <li>Game session logs</li>
          </ul>
        </div>

        {lastExport && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-3 w-3 text-emerald-500" />
            Last exported: {lastExport}
          </div>
        )}

        <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full sm:w-auto">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export All My Data
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
