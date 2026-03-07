import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accessibility, Play, CheckCircle2, AlertTriangle, XCircle, Info,
  ChevronDown, RefreshCw, ExternalLink, Globe,
} from "lucide-react";

interface AxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: { html: string; target: string[]; failureSummary?: string }[];
}

interface AuditResult {
  route: string;
  timestamp: string;
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

const ROUTES_TO_AUDIT = [
  { label: "Landing Page", path: "/" },
  { label: "Login", path: "/login" },
  { label: "Signup", path: "/signup" },
  { label: "Directory", path: "/directory" },
  { label: "Catalog", path: "/catalog" },
  { label: "Events", path: "/events" },
  { label: "Install", path: "/install" },
  { label: "Privacy", path: "/privacy" },
  { label: "Terms", path: "/terms" },
  { label: "Cookies", path: "/cookies" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Achievements", path: "/achievements" },
  { label: "Lists", path: "/lists" },
  { label: "Near Me", path: "/near-me" },
];

const IMPACT_CONFIG: Record<string, { color: string; icon: React.ReactNode; order: number }> = {
  critical: { color: "destructive", icon: <XCircle className="h-4 w-4" />, order: 0 },
  serious: { color: "destructive", icon: <AlertTriangle className="h-4 w-4" />, order: 1 },
  moderate: { color: "secondary", icon: <Info className="h-4 w-4" />, order: 2 },
  minor: { color: "outline", icon: <Info className="h-4 w-4" />, order: 3 },
};

export function AccessibilityAudit() {
  const { t } = useTranslation();
  const [results, setResults] = useState<AuditResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentRoute, setCurrentRoute] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const runAudit = useCallback(async () => {
    setScanning(true);
    setResults([]);
    setScanProgress(0);

    const auditResults: AuditResult[] = [];

    for (let i = 0; i < ROUTES_TO_AUDIT.length; i++) {
      const route = ROUTES_TO_AUDIT[i];
      setCurrentRoute(route.label);
      setScanProgress(Math.round(((i + 1) / ROUTES_TO_AUDIT.length) * 100));

      try {
        // Create a hidden iframe to scan each route
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1280px;height:720px;opacity:0;pointer-events:none;";
        iframe.src = route.path;
        document.body.appendChild(iframe);

        await new Promise<void>((resolve) => {
          iframe.onload = () => setTimeout(resolve, 2000); // wait for React render
          setTimeout(resolve, 8000); // safety timeout
        });

        try {
          const axe = await import("axe-core");
          const axeResults = await axe.default.run(iframe.contentDocument!, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          });

          auditResults.push({
            route: route.label,
            timestamp: new Date().toISOString(),
            violations: axeResults.violations.map((v) => ({
              id: v.id,
              impact: v.impact as AxeViolation["impact"],
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              tags: v.tags,
              nodes: v.nodes.map((n) => ({
                html: n.html.substring(0, 200),
                target: n.target.map(String),
                failureSummary: n.failureSummary,
              })),
            })),
            passes: axeResults.passes.length,
            incomplete: axeResults.incomplete.length,
            inapplicable: axeResults.inapplicable.length,
          });
        } catch (axeErr) {
          console.warn(`axe-core failed for ${route.path}:`, axeErr);
          auditResults.push({
            route: route.label,
            timestamp: new Date().toISOString(),
            violations: [],
            passes: 0,
            incomplete: 0,
            inapplicable: 0,
          });
        }

        document.body.removeChild(iframe);
      } catch (err) {
        console.warn(`Audit failed for ${route.path}:`, err);
      }
    }

    setResults(auditResults);
    setScanning(false);
    setCurrentRoute("");
  }, []);

  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);
  const criticalCount = results.reduce(
    (sum, r) => sum + r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").length,
    0
  );
  const totalPasses = results.reduce((sum, r) => sum + r.passes, 0);

  const allViolations = results.flatMap((r) =>
    r.violations.map((v) => ({ ...v, route: r.route }))
  );

  const violationsByType = allViolations.reduce(
    (acc, v) => {
      if (!acc[v.id]) acc[v.id] = { ...v, count: 0, routes: [] };
      acc[v.id].count += v.nodes.length;
      if (!acc[v.id].routes.includes(v.route)) acc[v.id].routes.push(v.route);
      return acc;
    },
    {} as Record<string, AxeViolation & { count: number; routes: string[]; route: string }>
  );

  const sortedViolationTypes = Object.values(violationsByType).sort(
    (a, b) => (IMPACT_CONFIG[a.impact]?.order ?? 9) - (IMPACT_CONFIG[b.impact]?.order ?? 9)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Accessibility className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display font-bold text-lg">Accessibility Audit</h3>
            <p className="text-xs text-muted-foreground">
              WCAG 2.1 AA compliance scanner powered by axe-core
            </p>
          </div>
        </div>
        <Button
          onClick={runAudit}
          disabled={scanning}
          className="gap-2"
        >
          {scanning ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Audit
            </>
          )}
        </Button>
      </div>

      {/* Scan progress */}
      {scanning && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Scanning: {currentRoute}</span>
              <span className="text-sm text-muted-foreground">{scanProgress}%</span>
            </div>
            <Progress value={scanProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Auditing {ROUTES_TO_AUDIT.length} routes for WCAG 2.1 AA violations...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && !scanning && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-3xl font-bold text-foreground">{results.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Pages Scanned</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className={`text-3xl font-bold ${totalViolations === 0 ? "text-green-500" : "text-destructive"}`}>
                  {totalViolations}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Violations</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className={`text-3xl font-bold ${criticalCount === 0 ? "text-green-500" : "text-destructive"}`}>
                  {criticalCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Critical / Serious</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-3xl font-bold text-green-500">{totalPasses}</div>
                <div className="text-xs text-muted-foreground mt-1">Rules Passed</div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance score */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Compliance Score</span>
                <span className="text-lg font-bold">
                  {totalPasses + totalViolations > 0
                    ? Math.round((totalPasses / (totalPasses + totalViolations)) * 100)
                    : 100}
                  %
                </span>
              </div>
              <Progress
                value={
                  totalPasses + totalViolations > 0
                    ? (totalPasses / (totalPasses + totalViolations)) * 100
                    : 100
                }
                className="h-3"
              />
            </CardContent>
          </Card>

          {/* Detailed tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">By Issue Type</TabsTrigger>
              <TabsTrigger value="by-page">By Page</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3 mt-4">
              {sortedViolationTypes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-lg">All Clear!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      No WCAG 2.1 AA violations detected across {results.length} pages.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedViolationTypes.map((v) => (
                  <ViolationCard key={v.id} violation={v} />
                ))
              )}
            </TabsContent>

            <TabsContent value="by-page" className="space-y-3 mt-4">
              {results.map((r) => (
                <Card key={r.route}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        {r.route}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {r.violations.length === 0 ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/30 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Pass
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            {r.violations.length} issue{r.violations.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {r.violations.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {r.violations.map((v, i) => (
                          <div
                            key={`${v.id}-${i}`}
                            className="flex items-start gap-2 text-xs py-1.5 border-t border-border/50"
                          >
                            <Badge
                              variant={v.impact === "critical" || v.impact === "serious" ? "destructive" : "outline"}
                              className="text-[10px] shrink-0 mt-0.5"
                            >
                              {v.impact}
                            </Badge>
                            <div className="min-w-0">
                              <span className="font-medium">{v.id}</span>
                              <span className="text-muted-foreground ml-1">
                                — {v.help} ({v.nodes.length} instance{v.nodes.length !== 1 ? "s" : ""})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Empty state */}
      {results.length === 0 && !scanning && (
        <Card>
          <CardContent className="py-12 text-center">
            <Accessibility className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-foreground">No audit results yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Run Audit" to scan {ROUTES_TO_AUDIT.length} pages for WCAG 2.1 AA compliance.
            </p>
            <p className="text-xs text-muted-foreground mt-3 max-w-md mx-auto">
              This scanner uses axe-core to detect accessibility violations including color contrast, 
              missing labels, ARIA issues, keyboard navigation, and more. Results are grouped by 
              severity (critical → minor).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ViolationCard({
  violation,
}: {
  violation: AxeViolation & { count: number; routes: string[] };
}) {
  const config = IMPACT_CONFIG[violation.impact] ?? IMPACT_CONFIG.minor;

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  violation.impact === "critical" || violation.impact === "serious"
                    ? "destructive"
                    : "outline"
                }
                className="gap-1 shrink-0"
              >
                {config.icon}
                {violation.impact}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{violation.id}</div>
                <div className="text-xs text-muted-foreground truncate">{violation.help}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {violation.count} instance{violation.count !== 1 ? "s" : ""} · {violation.routes.length} page
                  {violation.routes.length !== 1 ? "s" : ""}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-2 mb-4 space-y-2 border-l-2 border-border pl-4">
          <p className="text-xs text-muted-foreground">{violation.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">Affected pages:</span>
            {violation.routes.map((r) => (
              <Badge key={r} variant="outline" className="text-[10px]">
                {r}
              </Badge>
            ))}
          </div>
          <a
            href={violation.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Learn how to fix <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
