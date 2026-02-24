import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Shield, Cookie, Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";

export default function Legal() {
  const { t } = useTranslation();

  const legalPages = [
    {
      title: t("legal.privacyPolicy"),
      description: t("legal.privacyDesc"),
      icon: Shield,
      path: "/privacy",
    },
    {
      title: t("legal.termsOfService"),
      description: t("legal.termsDesc"),
      icon: Scale,
      path: "/terms",
    },
    {
      title: t("legal.cookiePolicy"),
      description: t("legal.cookieDesc"),
      icon: Cookie,
      path: "/cookies",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        <div className="container max-w-4xl py-16 px-4">
          <div className="text-center mb-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-display font-bold mb-4">{t("legal.title")}</h1>
            <p className="text-lg text-muted-foreground">{t("legal.subtitle")}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {legalPages.map((page) => (
              <Link key={page.path} to={page.path}>
                <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
                  <CardHeader className="text-center">
                    <page.icon className="h-10 w-10 mx-auto mb-2 text-primary" />
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">{page.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>{t("legal.lastUpdated")}</p>
            <p className="mt-2">
              {t("legal.questions")}{" "}
              <a href="mailto:legal@gametaverns.com" className="text-primary hover:underline">
                {t("legal.contactUs")}
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
