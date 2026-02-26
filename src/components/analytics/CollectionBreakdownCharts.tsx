import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Gamepad2, Layers, Package, TrendingUp } from "lucide-react";
import { useCollectionBreakdown } from "@/hooks/useCollectionBreakdown";
import { GameImage } from "@/components/games/GameImage";

const COLORS = [
  "hsl(210, 80%, 55%)",
  "hsl(142, 60%, 45%)",
  "hsl(38, 85%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(190, 75%, 50%)",
  "hsl(330, 65%, 55%)",
  "hsl(60, 70%, 45%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
};

const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

interface Props {
  libraryId: string;
}

export function CollectionBreakdownCharts({ libraryId }: Props) {
  const { data, isLoading } = useCollectionBreakdown(libraryId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (!data || data.totalOwned === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Add games to see collection analytics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.totalOwned}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Owned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Layers className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{data.totalExpansions}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expansions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <div className="text-2xl font-bold text-foreground">{data.percentUnplayed}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unplayed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Gamepad2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold text-foreground">{data.totalPreviouslyOwned}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Prev. Owned</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Player count distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Games by Max Player Count</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.byPlayerCount}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis dataKey="label" tick={tickStyle} />
                <YAxis allowDecimals={false} tick={tickStyle} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Difficulty distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Games by Difficulty</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byDifficulty.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.byDifficulty}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.byDifficulty.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No difficulty data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collection growth */}
      {data.collectionGrowth.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Collection Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.collectionGrowth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis dataKey="date" tick={tickStyle} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={tickStyle} width={30} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Shelf of shame */}
      {data.shelfOfShame.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Shelf of Shame
            </CardTitle>
            <CardDescription className="text-xs">Owned games you haven't played yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {data.shelfOfShame.map((game) => (
                <div key={game.id} className="text-center">
                  <div className="aspect-square rounded overflow-hidden bg-muted mb-1">
                    <GameImage
                      imageUrl={game.image_url || ""}
                      alt={game.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-foreground truncate">{game.title}</p>
                  <p className="text-[9px] text-muted-foreground">{game.addedDaysAgo}d ago</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
