import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { useLending } from "@/hooks/useLending";
import { SpokePageLayout } from "@/components/dashboard/SpokePageLayout";
import { LendingDashboard } from "@/components/lending/LendingDashboard";
import { TradeCenter } from "@/components/trades/TradeCenter";
import { isSelfHostedSupabaseStack } from "@/config/runtime";

const cardClass = "bg-wood-medium/30 border-wood-medium/50 text-cream";

export default function LendingPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loading } = useAuth();
  const { data: library } = useMyLibrary();
  const { myLentLoans, myBorrowedLoans } = useLending();
  const navigate = useNavigate();

  const pendingLoanRequests = myLentLoans.filter(l => l.status === "requested").length;
  const activeBorrowedLoans = myBorrowedLoans.filter(l => ['requested', 'approved', 'active'].includes(l.status));

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  return (
    <SpokePageLayout
      title="Lending & Loans"
      description={`${pendingLoanRequests} pending requests · ${activeBorrowedLoans.length} borrowed`}
      icon={BookOpen}
      iconColor="hsl(24, 80%, 50%)"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lending Dashboard */}
        {library && (
          <Card className={`${cardClass} lg:col-span-2`}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-secondary" />
                {t('dashboard.lending')}
                {pendingLoanRequests > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{pendingLoanRequests} {t('dashboard.pending')}</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-cream/60 text-xs">{t('dashboard.lendingDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <LendingDashboard libraryId={library.id} />
            </CardContent>
          </Card>
        )}

        {/* Borrowed Games */}
        <Card className={cardClass}>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-secondary" />
              {t('dashboard.borrowedGames')}
              {activeBorrowedLoans.length > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{activeBorrowedLoans.length}</Badge>}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.borrowedGamesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {activeBorrowedLoans.length === 0 ? (
              <p className="text-xs text-cream/60 text-center py-2">{t('dashboard.noActiveBorrows')}</p>
            ) : (
              <div className="space-y-1.5">
                {activeBorrowedLoans.slice(0, 10).map((loan) => (
                  <div key={loan.id} className="flex flex-col p-2 rounded-lg bg-wood-medium/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate">{loan.game?.title || "Unknown Game"}</span>
                      <Badge variant="outline" className="text-[10px]">{loan.status}</Badge>
                    </div>
                    {loan.library?.name && (
                      <span className="text-[10px] text-cream/60 mt-0.5">{t('dashboard.from')}: {loan.library.name}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trading */}
        <Card className={`${cardClass} lg:col-span-3`}>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowLeftRight className="h-4 w-4 text-secondary" />
              {t('dashboard.trading')}
            </CardTitle>
            <CardDescription className="text-cream/60 text-xs">{t('dashboard.tradingDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isSelfHostedSupabaseStack() ? (
              <TradeCenter />
            ) : (
              <div className="text-center py-4">
                <ArrowLeftRight className="h-8 w-8 mx-auto text-cream/30 mb-2" />
                <p className="text-cream/60 text-xs">{t('dashboard.selfHostedOnly')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SpokePageLayout>
  );
}
