import { useTranslation } from "react-i18next";
import { Construction, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Maintenance() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <Construction className="h-16 w-16 text-primary" />
              <Wrench className="h-8 w-8 text-muted-foreground absolute -bottom-1 -right-1 rotate-45" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{t('maintenance.title')}</h1>
            <p className="text-muted-foreground">{t('maintenance.subtitle')}</p>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('maintenance.body')}</p>
          </div>
          
          <div className="pt-4">
            <p className="text-xs text-muted-foreground/70">
              {t('maintenance.adminNote')}{" "}
              <a href="/login" className="text-primary hover:underline">{t('maintenance.logIn')}</a>{" "}
              {t('maintenance.toAccess')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
