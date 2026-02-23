import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Link, Users, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase, isSelfHostedMode, isSelfHostedSupabaseStack, apiClient } from "@/integrations/backend/client";
import { getSupabaseConfig } from "@/config/runtime";
import { Capacitor } from "@capacitor/core";
import { useTenant } from "@/contexts/TenantContext";
import {
  detectFileFormat,
  parseBGStatsGames,
  parseBGStatsPlays,
  parseBGAExportCSV,
  getFormatLabel,
  type DetectedFormat,
  type ParsedPlay,
  type BGStatsExport,
} from "@/lib/import-parsers";

type ImportMode = "csv" | "bgg_collection" | "bgg_links";

type ImportResult = {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  errorSummary?: string;
  failureBreakdown?: {
    already_exists: number;
    missing_title: number;
    create_failed: number;
    exception: number;
    not_found: number;
  };
  games: { title: string; id?: string }[];
  notFoundGames?: string[];
};

function normalizeImportResult(data: any): ImportResult {
  return {
    success: Boolean(data?.success),
    imported: Number(data?.imported ?? 0),
    failed: Number(data?.failed ?? 0),
    errors: Array.isArray(data?.errors) ? data.errors : [],
    errorSummary: typeof data?.errorSummary === "string" ? data.errorSummary : undefined,
    failureBreakdown: data?.failureBreakdown && typeof data.failureBreakdown === "object"
      ? data.failureBreakdown
      : undefined,
    games: Array.isArray(data?.games) ? data.games : [],
    notFoundGames: Array.isArray(data?.notFoundGames) ? data.notFoundGames : undefined,
  };
}

type ProgressData = {
  type: "start" | "progress" | "complete";
  jobId?: string;
  current?: number;
  total?: number;
  imported?: number;
  failed?: number;
  currentGame?: string;
  phase?: string;
  success?: boolean;
  errors?: string[];
  games?: { title: string; id?: string }[];
};

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
  isDemo?: boolean;
  onDemoImport?: (games: any[]) => void;
  defaultMode?: ImportMode;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  isDemo = false,
  onDemoImport,
  defaultMode = "csv",
}: BulkImportDialogProps) {
  const { toast } = useToast();
  const { library } = useTenant();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ImportMode>(defaultMode);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const lastImportedCountRef = useRef<number>(0);
  const jobIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [streamDisconnected, setStreamDisconnected] = useState(false);
  
  // Auto play-history import state
  const [playImportStatus, setPlayImportStatus] = useState<{
    phase: "idle" | "importing" | "done" | "error";
    imported?: number;
    skipped?: number;
    failed?: number;
    unmatchedGames?: string[];
    error?: string;
  }>({ phase: "idle" });
  
  // Update mode when defaultMode changes (e.g., when dialog opens with different mode)
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
    }
  }, [open, defaultMode]);

  // Progress state
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    imported: number;
    failed: number;
    currentGame: string;
    phase: string;
  } | null>(null);

  // Poll import_jobs table for progress when SSE stream disconnects
  const pollJobProgress = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from("import_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error || !data) return;

      const totalItems = data.total_items || 0;
      const processedItems = data.processed_items || 0;
      const successfulItems = data.successful_items || 0;
      const failedItems = data.failed_items || 0;

      if (data.status === "completed" || data.status === "failed") {
        // Import finished — stop polling
        stopPolling();
        setIsImporting(false);
        setStreamDisconnected(false);
        
        queryClient.invalidateQueries({ queryKey: ["games"] });
        queryClient.invalidateQueries({ queryKey: ["games-flat"] });
        
        setResult({
          success: data.status === "completed",
          imported: successfulItems,
          failed: failedItems,
          errors: data.error_message ? [data.error_message] : [],
          games: [],
        });
        
        toast({
          title: data.status === "completed" ? "Import complete!" : "Import finished with errors",
          description: `${successfulItems} imported, ${failedItems} failed.`,
        });
        onImportComplete?.();
        return;
      }

      // Still processing — update progress
      setProgress({
        current: processedItems,
        total: totalItems,
        imported: successfulItems,
        failed: failedItems,
        currentGame: `Processing... (${processedItems}/${totalItems})`,
        phase: "importing",
      });
      
      // Periodically refresh game list
      if (successfulItems > lastImportedCountRef.current) {
        lastImportedCountRef.current = successfulItems;
        const now = Date.now();
        if (now - lastRefreshRef.current > 3000) {
          lastRefreshRef.current = now;
          queryClient.invalidateQueries({ queryKey: ["games"] });
          queryClient.invalidateQueries({ queryKey: ["games-flat"] });
        }
      }
    } catch (e) {
      console.warn("[BulkImport] Job poll error:", e);
    }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    setStreamDisconnected(true);
    console.log("[BulkImport] SSE disconnected, switching to job polling for:", jobId);
    // Poll every 3 seconds
    pollingIntervalRef.current = setInterval(() => pollJobProgress(jobId), 3000);
    // Also poll immediately
    pollJobProgress(jobId);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // When tab becomes visible again, check job status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && jobIdRef.current && isImporting) {
        console.log("[BulkImport] Tab visible again, checking job:", jobIdRef.current);
        pollJobProgress(jobIdRef.current);
        // If we're not already polling (SSE might have died while tab was hidden), start
        if (!pollingIntervalRef.current) {
          startPolling(jobIdRef.current);
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isImporting]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // CSV/JSON mode
  const [csvData, setCsvData] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null);
  const [pendingPlays, setPendingPlays] = useState<ParsedPlay[] | null>(null);
  const filePickerActiveRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  // On native, block dialog close for a generous window after ANY interaction
  // with the file input. Capacitor resume events fire unpredictably.
  const markFilePickerActive = useCallback(() => {
    filePickerActiveRef.current = true;
    // Safety timeout: 60s on native (file picker can take a while), 30s on web
    const timeout = isNative ? 60000 : 30000;
    setTimeout(() => { filePickerActiveRef.current = false; }, timeout);
  }, [isNative]);

  const handleDialogOpenChange = useCallback((v: boolean) => {
    // Never allow programmatic close while importing
    if (!v && isImporting) return;
    // On native, block close while file picker might be active
    if (!v && filePickerActiveRef.current) {
      console.log("[BulkImport] Blocked dialog close — file picker active");
      return;
    }
    onOpenChange(v);
  }, [isImporting, onOpenChange]);

  // BGG Collection mode
  const [bggUsername, setBggUsername] = useState("");

  // BGG Links mode
  const [bggLinks, setBggLinks] = useState("");

  // Common options
  const [enhanceWithBgg, setEnhanceWithBgg] = useState(true);
  const [enhanceWithAi, setEnhanceWithAi] = useState(false);
  const [locationRoom, setLocationRoom] = useState("");
  const [locationShelf, setLocationShelf] = useState("");
  const [locationMisc, setLocationMisc] = useState("");

  // NOTE: We intentionally do NOT abort on unmount/dialog close.
  // This allows the import to continue in the background even when the user
  // switches tabs or navigates away. The import job is tracked in the database
  // and will complete server-side regardless of client connection.

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setDetectedFormat(null);
    setPendingPlays(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      // Parse Excel file to CSV using SheetJS
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(firstSheet);
        setCsvData(csvText);
        setDetectedFormat("csv");
        toast({
          title: "Excel file loaded",
          description: `Converted "${file.name}" to CSV format (${csvText.split("\n").length - 1} rows)`,
        });
      } catch (err) {
        console.error("XLSX parse error:", err);
        toast({
          title: "Failed to parse Excel file",
          description: "Please try saving as CSV and uploading again.",
          variant: "destructive",
        });
      }
    } else {
      const text = await file.text();
      const format = detectFileFormat(text, file.name);
      setDetectedFormat(format);

      if (format === "bgstats") {
        try {
          const bgstatsData: BGStatsExport = JSON.parse(text);
          // Convert games to CSV for the game-import pipeline
          const csvFromBGStats = parseBGStatsGames(bgstatsData);
          setCsvData(csvFromBGStats);
          // Parse plays for import after games are done
          const plays = parseBGStatsPlays(bgstatsData);
          setPendingPlays(plays.length > 0 ? plays : null);
          toast({
            title: "BGStats export detected",
            description: `Found ${bgstatsData.games.length} games and ${plays.length} play sessions`,
          });
        } catch (err) {
          console.error("BGStats parse error:", err);
          setCsvData(text);
          toast({
            title: "Failed to parse BGStats file",
            description: "File will be treated as generic JSON.",
            variant: "destructive",
          });
        }
      } else if (format === "bga_csv") {
        const convertedCsv = parseBGAExportCSV(text);
        setCsvData(convertedCsv);
        toast({
          title: "Board Game Arena export detected",
          description: `Extracted unique games from BGA stats export`,
        });
      } else {
        setCsvData(text);
      }
    }
  };

  const resetForm = () => {
    setCsvData("");
    setCsvFile(null);
    setDetectedFormat(null);
    setPendingPlays(null);
    setBggUsername("");
    setBggLinks("");
    setLocationRoom("");
    setLocationShelf("");
    setLocationMisc("");
    setEnhanceWithAi(false);
    setResult(null);
    setProgress(null);
    setPlayImportStatus({ phase: "idle" });
    setStreamDisconnected(false);
    jobIdRef.current = null;
    stopPolling();
  };

  // Import pre-parsed plays (from BGStats JSON) after game import
  const importParsedPlays = async (plays: ParsedPlay[], libraryId: string) => {
    setPlayImportStatus({ phase: "importing" });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setPlayImportStatus({ phase: "error", error: "Authentication expired" });
        return;
      }

      const { url: apiUrl, anonKey } = getSupabaseConfig();
      const fullUrl = `${apiUrl}/functions/v1/bgg-play-import`;

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          source: "bgstats",
          plays: plays,
          library_id: libraryId,
          update_existing: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setPlayImportStatus({
          phase: "error",
          error: (errorData as any)?.error || `HTTP ${response.status}`,
        });
        return;
      }

      const data = await response.json();
      setPlayImportStatus({
        phase: "done",
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        failed: data.failed || 0,
        unmatchedGames: data.details?.unmatchedGames,
      });

      queryClient.invalidateQueries({ queryKey: ["game-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["play-stats"] });

      if ((data.imported || 0) > 0) {
        toast({
          title: "Play history imported!",
          description: `${data.imported} play${data.imported !== 1 ? "s" : ""} imported from BGStats`,
        });
      }
    } catch (e) {
      console.error("Parsed play import error:", e);
      setPlayImportStatus({
        phase: "error",
        error: e instanceof Error ? e.message : "Failed to import play history",
      });
    }
  };

  // Auto-import play history after BGG collection import
  const autoImportPlayHistory = async (username: string, libraryId: string) => {
    setPlayImportStatus({ phase: "importing" });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setPlayImportStatus({ phase: "error", error: "Authentication expired" });
        return;
      }

      const { url: apiUrl, anonKey } = getSupabaseConfig();
      const fullUrl = `${apiUrl}/functions/v1/bgg-play-import`;

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          bgg_username: username,
          library_id: libraryId,
          update_existing: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setPlayImportStatus({
          phase: "error",
          error: (errorData as any)?.error || `HTTP ${response.status}`,
        });
        return;
      }

      const data = await response.json();
      setPlayImportStatus({
        phase: "done",
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        failed: data.failed || 0,
        unmatchedGames: data.details?.unmatchedGames,
      });

      // Invalidate play-related queries
      queryClient.invalidateQueries({ queryKey: ["game-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["play-stats"] });

      if ((data.imported || 0) > 0) {
        toast({
          title: "Play history imported!",
          description: `${data.imported} play${data.imported !== 1 ? "s" : ""} imported from BGG`,
        });
      }
    } catch (e) {
      console.error("Auto play-history import error:", e);
      setPlayImportStatus({
        phase: "error",
        error: e instanceof Error ? e.message : "Failed to import play history",
      });
    }
  };

  const handleImport = async () => {
    console.log("[BulkImport] Starting import...");
    console.log("[BulkImport] isDemo:", isDemo);
    console.log("[BulkImport] isSelfHostedMode():", isSelfHostedMode());
    console.log("[BulkImport] isSelfHostedSupabaseStack():", isSelfHostedSupabaseStack());
    console.log("[BulkImport] library_id:", library?.id);
    
    setIsImporting(true);
    setResult(null);
    setProgress(null);

    try {
      const payload: any = {
        mode,
        library_id: library?.id,
        enhance_with_bgg: enhanceWithBgg,
        enhance_with_ai: enhanceWithAi,
        default_options: {
          location_room: locationRoom.trim() || null,
          location_shelf: locationShelf.trim() || null,
          location_misc: locationMisc.trim() || null,
        },
      };

      if (mode === "csv") {
        if (!csvData.trim()) {
          toast({
            title: "No data",
            description: "Please upload a CSV file or paste CSV data",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }
        payload.csv_data = csvData;
      } else if (mode === "bgg_collection") {
        // Extract username from BGG profile URL if user pasted a link
        let parsedUsername = bggUsername.trim();
        const bggUrlMatch = parsedUsername.match(/boardgamegeek\.com\/user\/([^\/\?#]+)/i);
        if (bggUrlMatch) {
          parsedUsername = decodeURIComponent(bggUrlMatch[1]);
        }
        if (!parsedUsername) {
          toast({
            title: "Username required",
            description: "Please enter a BoardGameGeek username or profile URL",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }
        payload.bgg_username = parsedUsername;
      } else if (mode === "bgg_links") {
        const links = bggLinks
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && l.includes("boardgamegeek.com"));
        if (links.length === 0) {
          toast({
            title: "No valid links",
            description: "Please enter at least one BoardGameGeek URL",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }
        payload.bgg_links = links;
      }

      console.log("[BulkImport] Checking demo mode: isDemo=", isDemo, "onDemoImport=", !!onDemoImport);
      if (isDemo && onDemoImport) {
        // Demo mode - simulate import (existing demo logic)
        await handleDemoImport(payload);
        return;
      }

      console.log("[BulkImport] Checking legacy Express mode: isSelfHostedMode() && !isSelfHostedSupabaseStack() =", isSelfHostedMode() && !isSelfHostedSupabaseStack());
      // Legacy Express API mode only: use local API
      if (isSelfHostedMode() && !isSelfHostedSupabaseStack()) {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          toast({
            title: "Authentication required",
            description: "Please log in to import games",
            variant: "destructive",
          });
          setIsImporting(false);
          return;
        }

        // For self-hosted, use simple POST (no streaming for now)
        try {
          const raw = await apiClient.post<any>("/games/bulk-import", payload);
          const result = normalizeImportResult(raw);
          setResult(result);

          if (result.imported > 0) {
            toast({
              title: "Import complete!",
              description: `Successfully imported ${result.imported} game${result.imported !== 1 ? "s" : ""}${result.failed > 0 ? `. ${result.failed} failed.` : ""}`,
            });
            onImportComplete?.();
          } else if (result.failed > 0) {
            toast({
              title: "Import failed",
              description: `All ${result.failed} games failed to import. Check the errors below.`,
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Import failed",
            description: error instanceof Error ? error.message : "An error occurred during import",
            variant: "destructive",
          });
        } finally {
          setIsImporting(false);
          setProgress(null);
        }
        return;
      }

      // Cloud / self-hosted Supabase stack: Get auth token
      console.log("[BulkImport] Using Supabase client path (Cloud or self-hosted stack)");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      console.log("[BulkImport] Got session token:", token ? "yes" : "no");
      
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please log in to import games",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const { url: apiUrl, anonKey } = getSupabaseConfig();
      console.log("[BulkImport] Supabase config: url=", apiUrl, "anonKey present=", !!anonKey);

      // Self-hosted Edge Runtime uses a router as the main service, and Kong
      // already strips `/functions/v1/` before forwarding to the runtime.
      // So we always call `/functions/v1/bulk-import` (NOT `/main/bulk-import`).
      const bulkImportPath = "bulk-import";
      const fullUrl = `${apiUrl}/functions/v1/${bulkImportPath}`;
      console.log("[BulkImport] Fetching:", fullUrl);

      // Use streaming fetch
      const response = await fetch(
        fullUrl,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "apikey": anonKey,
          },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        }
      );

      console.log("[BulkImport] Response status:", response.status, "ok:", response.ok);
      console.log("[BulkImport] Response headers:", [...response.headers.entries()]);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[BulkImport] Error response (HTTP", response.status, "):", errorText);
        let errorData: any = {};
        try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
        const serverMsg = errorData.error || errorData.message || errorText?.substring(0, 200) || "Unknown error";
        throw new Error(`Import failed (HTTP ${response.status}): ${serverMsg}`);
      }

      // Check if it's a streaming response
      const contentType = response.headers.get("Content-Type");
      console.log("[BulkImport] Content-Type:", contentType);
      if (contentType?.includes("text/event-stream")) {
        // Handle SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: ProgressData = JSON.parse(line.slice(6));
                
                if (data.type === "start") {
                  // Capture job ID for polling fallback
                  if (data.jobId) {
                    jobIdRef.current = data.jobId;
                    console.log("[BulkImport] Job ID captured:", data.jobId);
                  }
                  // Reset refs for new import
                  lastImportedCountRef.current = 0;
                  lastRefreshRef.current = 0;
                  
                  setProgress({
                    current: 0,
                    total: data.total || 0,
                    imported: 0,
                    failed: 0,
                    currentGame: "Starting...",
                    phase: "starting",
                  });
                } else if (data.type === "progress") {
                  const newImported = data.imported || 0;
                  const prevImported = lastImportedCountRef.current;
                  lastImportedCountRef.current = newImported;
                  
                  setProgress({
                    current: data.current || 0,
                    total: data.total || 0,
                    imported: newImported,
                    failed: data.failed || 0,
                    currentGame: data.currentGame || "",
                    phase: data.phase || "importing",
                  });
                  
                  // Refresh games list when new games are imported (debounced to every 2 seconds max)
                  if (newImported > prevImported) {
                    const now = Date.now();
                    if (now - lastRefreshRef.current > 2000) {
                      lastRefreshRef.current = now;
                      queryClient.invalidateQueries({ queryKey: ["games"] });
                      queryClient.invalidateQueries({ queryKey: ["games-flat"] });
                    }
                  }
                } else if (data.type === "complete") {
                  // Reset refs for next import
                  lastImportedCountRef.current = 0;
                  // Final refresh to ensure all games are shown
                  queryClient.invalidateQueries({ queryKey: ["games"] });
                  queryClient.invalidateQueries({ queryKey: ["games-flat"] });
                  
                  setResult({
                    success: data.success || false,
                    imported: data.imported || 0,
                    failed: data.failed || 0,
                    errors: data.errors || [],
                    errorSummary: (data as any).errorSummary,
                    failureBreakdown: (data as any).failureBreakdown,
                    games: data.games || [],
                  });

                  // Handle play history from CSV (BG Stats format)
                  const playHistory = (data as any).playHistory;
                  if (playHistory) {
                    setPlayImportStatus({
                      phase: "done",
                      imported: playHistory.imported || 0,
                      skipped: playHistory.skipped || 0,
                      failed: playHistory.failed || 0,
                    });
                    if ((playHistory.imported || 0) > 0) {
                      queryClient.invalidateQueries({ queryKey: ["game-sessions"] });
                      queryClient.invalidateQueries({ queryKey: ["play-stats"] });
                    }
                  }

                  if ((data.imported || 0) > 0) {
                    const playMsg = playHistory && playHistory.imported > 0
                      ? ` Plus ${playHistory.imported} play session${playHistory.imported !== 1 ? "s" : ""}.`
                      : "";
                    toast({
                      title: "Import complete!",
                      description: `Successfully imported ${data.imported} game${data.imported !== 1 ? "s" : ""}${(data.failed || 0) > 0 ? `. ${data.failed} failed.` : ""}.${playMsg}`,
                    });
                    onImportComplete?.();
                    
                    // Auto-import play history for BGG collection imports
                    if (mode === "bgg_collection" && bggUsername.trim() && library?.id) {
                      autoImportPlayHistory(bggUsername.trim(), library.id);
                    }
                    // Auto-import plays from BGStats JSON after games are imported
                    if (pendingPlays && pendingPlays.length > 0 && library?.id) {
                      importParsedPlays(pendingPlays, library.id);
                    }
                  } else if ((data.failed || 0) > 0) {
                    toast({
                      title: "Import failed",
                      description: `All ${data.failed} games failed to import. Check the errors below.`,
                      variant: "destructive",
                    });
                  }
                }
              } catch (parseError) {
                console.error("Error parsing SSE data:", parseError);
              }
            }
          }
        }
      } else {
        // Handle regular JSON response (fallback)
        const raw = await response.json();
        const data = normalizeImportResult(raw);
        setResult(data);

        if (data.imported > 0) {
          toast({
            title: "Import complete!",
            description: `Successfully imported ${data.imported} game${data.imported !== 1 ? "s" : ""}${data.failed > 0 ? `. ${data.failed} failed.` : ""}`,
          });
          onImportComplete?.();
        } else if (data.failed > 0) {
          toast({
            title: "Import failed",
            description: `All ${data.failed} games failed to import. Check the errors below.`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        toast({
          title: "Import cancelled",
          description: "The import was cancelled",
        });
      } else if (jobIdRef.current) {
        // SSE stream broke but server is still processing — switch to polling
        console.log("[BulkImport] Stream disconnected, switching to job polling");
        toast({
          title: "Import running in background",
          description: "The connection was interrupted but your import continues on the server. Progress will update automatically.",
        });
        startPolling(jobIdRef.current);
        return; // Don't clear isImporting — polling will handle completion
      } else {
        console.error("Bulk import error:", error);
        toast({
          title: "Import failed",
          description: error instanceof Error ? error.message : "An error occurred during import",
          variant: "destructive",
        });
      }
    } finally {
      // Only clean up if we're NOT falling back to polling
      if (!pollingIntervalRef.current) {
        setIsImporting(false);
        setProgress(null);
      }
      abortControllerRef.current = null;
    }
  };

  const renderFailureSummary = (r: ImportResult) => {
    const b = r.failureBreakdown;
    const hasNotFound = (b?.not_found ?? 0) > 0 || (r.notFoundGames?.length ?? 0) > 0;
    
    if (!r.failed && !hasNotFound) return null;
    if (!b && !r.errorSummary && !hasNotFound) return null;

    return (
      <>
        {(r.failed > 0) && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Why some games failed</AlertTitle>
            <AlertDescription>
              {r.errorSummary ? (
                <p className="text-sm">{r.errorSummary}</p>
              ) : null}
              {b ? (
                <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
                  {b.already_exists > 0 && <li>Already existed: {b.already_exists}</li>}
                  {b.missing_title > 0 && <li>Missing title: {b.missing_title}</li>}
                  {b.create_failed > 0 && <li>Create failed: {b.create_failed}</li>}
                  {b.exception > 0 && <li>Exceptions: {b.exception}</li>}
                  {b.not_found > 0 && <li>Not found in catalog or BGG: {b.not_found}</li>}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {hasNotFound && r.notFoundGames && r.notFoundGames.length > 0 && (
          <Alert className="mt-4 border-amber-500/50">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle>Games Not Found</AlertTitle>
            <AlertDescription>
              <p className="text-sm mb-2">
                The following games were not found in our catalog or on BoardGameGeek. You may need to add them manually:
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {r.notFoundGames.slice(0, 20).map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
                {r.notFoundGames.length > 20 && (
                  <li>...and {r.notFoundGames.length - 20} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </>
    );
  };

  // Demo import handler (extracted for clarity)
  const handleDemoImport = async (payload: any) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    let demoGames: any[] = [];
    
    if (mode === "csv") {
      // Parse CSV (existing demo logic)
      const parseCSV = (data: string): Record<string, string>[] => {
        if (!data || typeof data !== "string") return [];
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = "";
        let inQuotes = false;
        
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          const nextChar = data[i + 1];
          
          if (char === '"') {
            if (!inQuotes) {
              inQuotes = true;
            } else if (nextChar === '"') {
              currentField += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = "";
          } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            if (char === '\r') i++;
            currentRow.push(currentField.trim());
            if (currentRow.some(field => field !== "")) {
              rows.push(currentRow);
            }
            currentRow = [];
            currentField = "";
          } else if (char === '\r' && !inQuotes) {
            currentRow.push(currentField.trim());
            if (currentRow.some(field => field !== "")) {
              rows.push(currentRow);
            }
            currentRow = [];
            currentField = "";
          } else {
            currentField += char;
          }
        }
        
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some(field => field !== "")) {
            rows.push(currentRow);
          }
        }
        
        if (rows.length < 2) return [];
        
        const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
        const result: Record<string, string>[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const values = rows[i];
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || "";
          });
          result.push(row);
        }
        
        return result;
      };
      
      const parsedRows = parseCSV(csvData || "");
      
      const parseBool = (val: string | undefined): boolean => {
        if (!val) return false;
        const v = val.toLowerCase().trim();
        return v === "true" || v === "yes" || v === "1";
      };
      
      const parseNum = (val: string | undefined): number | undefined => {
        if (!val) return undefined;
        const n = parseInt(val, 10);
        return isNaN(n) ? undefined : n;
      };
      
      const mapWeightToDifficulty = (weight: string | undefined): string | null => {
        if (!weight) return null;
        const w = parseFloat(weight);
        if (isNaN(w)) return null;
        if (w < 1.5) return "1 - Light";
        if (w < 2.25) return "2 - Medium Light";
        if (w < 3.0) return "3 - Medium";
        if (w < 3.75) return "4 - Medium Heavy";
        return "5 - Heavy";
      };
      
      const mapPlayTimeToEnum = (minutes: number | undefined): string | null => {
        if (!minutes) return null;
        if (minutes <= 15) return "0-15 Minutes";
        if (minutes <= 30) return "15-30 Minutes";
        if (minutes <= 45) return "30-45 Minutes";
        if (minutes <= 60) return "45-60 Minutes";
        if (minutes <= 120) return "60+ Minutes";
        if (minutes <= 180) return "2+ Hours";
        return "3+ Hours";
      };
      
      const isBGGExport = parsedRows.length > 0 && parsedRows[0].objectname !== undefined;
      
      const tempGames: any[] = [];
      for (const row of parsedRows) {
        const title = row.title || row.name || row.game || row.game_name || row.game_title || row.objectname;
        
        if (isBGGExport && row.own !== "1") {
          continue;
        }
        
        if (title) {
          const mechanicsStr = row.mechanics || row.mechanic || "";
          const mechanics = mechanicsStr
            .split(";")
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);
          
          const bggId = row.bgg_id || row.objectid || null;
          const minPlayersRaw = row.min_players || row.minplayers;
          const maxPlayersRaw = row.max_players || row.maxplayers;
          const playTimeRaw = row.play_time || row.playtime || row.playingtime;
          
          const isExpansion = parseBool(row.is_expansion) || 
                             row.itemtype === "expansion" || 
                             row.objecttype === "expansion";
          
          let difficulty = row.difficulty || row.weight || null;
          if (!difficulty && row.avgweight) {
            difficulty = mapWeightToDifficulty(row.avgweight);
          }
          
          let playTime = row.play_time || null;
          if (!playTime && playTimeRaw) {
            const playTimeNum = parseNum(playTimeRaw);
            playTime = mapPlayTimeToEnum(playTimeNum);
          }
          
          const suggestedAge = row.suggested_age || row.age || row.bggrecagerange || null;
          const isForSale = parseBool(row.is_for_sale) || parseBool(row.fortrade);
          
          tempGames.push({
            id: `demo-import-${Date.now()}-${tempGames.length}`,
            title,
            image_url: row.image_url || null,
            game_type: row.type || row.game_type || "Board Game",
            difficulty,
            play_time: playTime,
            min_players: parseNum(minPlayersRaw),
            max_players: parseNum(maxPlayersRaw),
            suggested_age: suggestedAge,
            publisher: row.publisher || null,
            mechanics: mechanics.length > 0 ? mechanics : undefined,
            bgg_id: bggId,
            bgg_url: bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : (row.bgg_url || null),
            description: row.description || null,
            is_expansion: isExpansion,
            parent_game_title: row.parent_game || null,
            is_coming_soon: parseBool(row.is_coming_soon),
            is_for_sale: isForSale,
            sale_price: parseNum(row.sale_price) || null,
            sale_condition: row.sale_condition || null,
            location_room: row.location_room || locationRoom || null,
            location_shelf: row.location_shelf || row.invlocation || locationShelf || null,
            location_misc: row.location_misc || locationMisc || null,
            sleeved: parseBool(row.sleeved),
            upgraded_components: parseBool(row.upgraded_components),
            crowdfunded: parseBool(row.crowdfunded),
            inserts: parseBool(row.inserts),
            in_base_game_box: parseBool(row.in_base_game_box),
          });
        }
      }
      
      const titleToId = new Map<string, string>();
      tempGames.forEach(g => titleToId.set(g.title.toLowerCase(), g.id));
      
      for (const game of tempGames) {
        if (game.is_expansion && game.parent_game_title) {
          const parentId = titleToId.get(game.parent_game_title.toLowerCase());
          if (parentId) {
            game.parent_game_id = parentId;
          }
        }
        demoGames.push(game);
      }
    } else if (mode === "bgg_collection") {
      const sampleGames = [
        "Wingspan", "Catan", "Ticket to Ride", "Pandemic", "Azul",
        "7 Wonders", "Dominion", "Carcassonne", "Splendor", "Codenames"
      ];
      demoGames = sampleGames.slice(0, 5).map((title, i) => ({
        id: `demo-bgg-${Date.now()}-${i}`,
        title,
        game_type: "Board Game",
        description: `A popular board game imported from BGG collection of ${bggUsername}`,
        location_room: locationRoom || "Game Room",
        location_shelf: locationShelf || null,
        location_misc: locationMisc || null,
      }));
    } else if (mode === "bgg_links") {
      const links = bggLinks.split("\n").filter(l => l.includes("boardgamegeek.com"));
      demoGames = links.map((link, i) => {
        const match = link.match(/\/boardgame\/\d+\/([^\/\?]+)/);
        const title = match ? match[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : `Game ${i + 1}`;
        return {
          id: `demo-link-${Date.now()}-${i}`,
          title,
          bgg_url: link,
          game_type: "Board Game",
          description: `Imported from BoardGameGeek`,
          location_room: locationRoom || "Game Room",
          location_shelf: locationShelf || null,
          location_misc: locationMisc || null,
        };
      });
    }
    
    if (demoGames.length > 0 && onDemoImport) {
      onDemoImport(demoGames);
      setResult({
        success: true,
        imported: demoGames.length,
        failed: 0,
        errors: [],
        games: demoGames.map(g => ({ title: g.title, id: g.id })),
      });
      toast({
        title: "Import complete!",
        description: `Successfully imported ${demoGames.length} game${demoGames.length !== 1 ? "s" : ""} (demo mode)`,
      });
    } else {
      setResult({
        success: false,
        imported: 0,
        failed: 1,
        errors: ["No valid games found to import"],
        games: [],
      });
      toast({
        title: "Import failed",
        description: "No valid games found to import",
        variant: "destructive",
      });
    }
    
    setIsImporting(false);
  };

  const handleCancel = () => {
    if (isImporting && jobIdRef.current) {
      // Import is running on the server — just close the dialog, don't abort
      toast({
        title: "Import continues in background",
        description: "You can reopen this dialog to check progress. The import will complete on the server.",
      });
      onOpenChange(false);
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onOpenChange(false);
  };

  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Bulk Import Games</DialogTitle>
          <DialogDescription>
            Import multiple games at once from CSV, BGG collection, or BGG links
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ImportMode)} className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="csv" className="gap-2" disabled={isImporting}>
                <FileText className="h-4 w-4" />
                File Import
              </TabsTrigger>
              <TabsTrigger value="bgg_collection" className="gap-2" disabled={isImporting}>
                <Users className="h-4 w-4" />
                BGG Collection
              </TabsTrigger>
              <TabsTrigger value="bgg_links" className="gap-2" disabled={isImporting}>
                <Link className="h-4 w-4" />
                BGG Links
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4 pr-4">
              {/* Progress indicator */}
              {progress && (
                <div className="mb-6 p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {streamDisconnected ? "Import running on server..." : "Importing games..."}
                    </span>
                    <span className="text-muted-foreground">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  {streamDisconnected && (
                    <p className="text-xs text-muted-foreground">
                      ℹ️ Connection was interrupted but your import continues on the server. 
                      You can close this dialog or switch tabs — progress will update when you return.
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    {progress.phase === "enhancing" ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : progress.phase === "imported" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : progress.phase === "error" ? (
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    <span className="truncate text-muted-foreground">
                      {progress.currentGame}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="text-green-600">✓ {progress.imported} imported</span>
                    {progress.failed > 0 && (
                      <span className="text-destructive">✕ {progress.failed} failed</span>
                    )}
                  </div>
                </div>
              )}

              <TabsContent value="csv" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  {/* Wrapped in div to prevent focus/click events from bubbling to dialog on mobile file picker. */}
                  <div onFocus={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.json,.bgsplay"
                      onPointerDown={() => markFilePickerActive()}
                      onClick={() => markFilePickerActive()}
                      onChange={(e) => { e.stopPropagation(); handleFileUpload(e); setTimeout(() => { filePickerActiveRef.current = false; }, 2000); }}
                      disabled={isImporting}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  {detectedFormat && (
                    <p className="text-xs font-medium text-primary">
                      ✓ Detected: {getFormatLabel(detectedFormat)}
                      {pendingPlays && ` (${pendingPlays.length} play sessions will be imported after games)`}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Supports CSV, Excel (.xlsx), BGStats JSON exports (.json/.bgsplay), and Board Game Arena CSV exports.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Or Paste CSV Data</Label>
                  <Textarea
                    placeholder={`title,bgg_id
Wingspan,266192
Catan,13
Ticket to Ride,9209`}
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={6}
                    disabled={isImporting}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="bgg_collection" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>BoardGameGeek Username or Profile URL</Label>
                  <Input
                    placeholder="e.g. johndoe or https://boardgamegeek.com/user/johndoe"
                    value={bggUsername}
                    onChange={(e) => setBggUsername(e.target.value)}
                    disabled={isImporting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Import all games marked as "Owned" in your BGG collection
                  </p>
                </div>

                {/* Show different messaging based on environment */}
                {isSelfHostedSupabaseStack() ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Direct Import Available</AlertTitle>
                    <AlertDescription>
                      <p className="text-sm">
                        Enter your BGG username to import all games marked as "Owned" in your collection.
                        This requires a BGG API token configured on your server.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Recommended: Use CSV Export</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>
                        Due to BGG API requirements, direct username import requires server-side API tokens. 
                        For Lovable Cloud, we recommend using BGG's CSV export:
                      </p>
                      <ol className="list-decimal list-inside text-xs space-y-1">
                        <li>Go to your <a href="https://boardgamegeek.com/collection/user/" target="_blank" rel="noopener noreferrer" className="text-primary underline">BGG Collection</a></li>
                        <li>Click the three dots menu (⋯) → Export</li>
                        <li>Download the CSV file</li>
                        <li>Use the "CSV/Excel" tab above to import</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="bgg_links" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>BoardGameGeek URLs (one per line)</Label>
                  <Textarea
                    placeholder={`https://boardgamegeek.com/boardgame/266192/wingspan
https://boardgamegeek.com/boardgame/13/catan
https://boardgamegeek.com/boardgame/9209/ticket-to-ride`}
                    value={bggLinks}
                    onChange={(e) => setBggLinks(e.target.value)}
                    rows={6}
                    disabled={isImporting}
                  />
                </div>
              </TabsContent>

              {/* Common options */}
              {!progress && (
                <div className="space-y-4 mt-6 pt-4 border-t">
                  <h4 className="font-medium">Import Options</h4>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enhance-bgg"
                      checked={enhanceWithBgg}
                      onCheckedChange={(checked) => setEnhanceWithBgg(!!checked)}
                      disabled={isImporting}
                    />
                    <Label htmlFor="enhance-bgg" className="cursor-pointer">
                      Fetch images &amp; basic data from BGG (fast, recommended)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enhance-ai"
                      checked={enhanceWithAi}
                      onCheckedChange={(checked) => setEnhanceWithAi(!!checked)}
                      disabled={isImporting || !enhanceWithBgg}
                    />
                    <div className="flex flex-col">
                      <Label htmlFor="enhance-ai" className={`cursor-pointer ${!enhanceWithBgg ? "text-muted-foreground" : ""}`}>
                        Enhance with AI descriptions &amp; gallery images (slower, ~8s per game)
                      </Label>
                      <span className="text-xs text-muted-foreground ml-0 mt-0.5">
                        Adds formatted gameplay overview and up to 5 gameplay photos
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Default Room</Label>
                      <Select value={locationRoom} onValueChange={setLocationRoom} disabled={isImporting}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="Living Room">Living Room</SelectItem>
                          <SelectItem value="Family Room">Family Room</SelectItem>
                          <SelectItem value="Game Room">Game Room</SelectItem>
                          <SelectItem value="Den">Den</SelectItem>
                          <SelectItem value="Basement">Basement</SelectItem>
                          <SelectItem value="Bedroom">Bedroom</SelectItem>
                          <SelectItem value="Office">Office</SelectItem>
                          <SelectItem value="Closet">Closet</SelectItem>
                          <SelectItem value="Attic">Attic</SelectItem>
                          <SelectItem value="Garage">Garage</SelectItem>
                          <SelectItem value="Dining Room">Dining Room</SelectItem>
                          <SelectItem value="Storage Room">Storage Room</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default Shelf</Label>
                      <Input
                        placeholder="e.g., Shelf A"
                        value={locationShelf}
                        onChange={(e) => setLocationShelf(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default Misc</Label>
                      <Input
                        placeholder="e.g., Box 1"
                        value={locationMisc}
                        onChange={(e) => setLocationMisc(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-3 mt-6 pt-4 border-t">
                  <h4 className="font-medium flex items-center gap-2">
                    {result.imported > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    Import Results
                  </h4>

                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">✓ {result.imported} imported</span>
                    {result.failed > 0 && (
                      <span className="text-destructive">✕ {result.failed} failed</span>
                    )}
                  </div>

                  {renderFailureSummary(result)}

                  {(result.errors?.length ?? 0) > 0 && (
                    <div className="bg-muted rounded p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium mb-2">Errors:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {result.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {(result.errors?.length ?? 0) > 10 && (
                          <li>...and {(result.errors?.length ?? 0) - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {(result.games?.length ?? 0) > 0 && (
                    <div className="bg-muted rounded p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-medium mb-2">Imported games:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {result.games.slice(0, 10).map((g, i) => (
                          <li key={i}>• {g.title}</li>
                        ))}
                        {(result.games?.length ?? 0) > 10 && (
                          <li>...and {(result.games?.length ?? 0) - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Auto play-history import status */}
                  {playImportStatus.phase !== "idle" && (
                    <Alert className="mt-4">
                      {playImportStatus.phase === "importing" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <AlertTitle>Importing play history...</AlertTitle>
                          <AlertDescription>
                            Fetching play logs from BoardGameGeek and matching to your library games.
                          </AlertDescription>
                        </>
                      ) : playImportStatus.phase === "done" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertTitle>Play history imported</AlertTitle>
                          <AlertDescription>
                            <div className="flex gap-3 text-sm mt-1">
                              {(playImportStatus.imported || 0) > 0 && <span>✓ {playImportStatus.imported} plays imported</span>}
                              {(playImportStatus.skipped || 0) > 0 && <span>{playImportStatus.skipped} skipped (duplicates)</span>}
                              {(playImportStatus.failed || 0) > 0 && <span className="text-destructive">{playImportStatus.failed} failed</span>}
                              {playImportStatus.imported === 0 && playImportStatus.skipped === 0 && playImportStatus.failed === 0 && <span>No plays found on BGG</span>}
                            </div>
                            {playImportStatus.unmatchedGames && playImportStatus.unmatchedGames.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {playImportStatus.unmatchedGames.length} game{playImportStatus.unmatchedGames.length !== 1 ? "s" : ""} not in your library (plays skipped)
                              </p>
                            )}
                          </AlertDescription>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Play history import failed</AlertTitle>
                          <AlertDescription>{playImportStatus.error || "Unknown error"}</AlertDescription>
                        </>
                      )}
                    </Alert>
                  )}
                </div>
              )}
            </ScrollArea>
          </Tabs>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <>
              <Button variant="outline" onClick={resetForm}>
                Import More
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {progress ? `${progressPercent}%` : "Starting..."}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
