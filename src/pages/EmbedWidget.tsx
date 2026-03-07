import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useMyLibrary } from "@/hooks/useLibrary";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Code, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = "https://gametaverns.com";

export default function EmbedWidget() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: library } = useMyLibrary();
  const [copied, setCopied] = useState<string | null>(null);
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "light">("dark");
  const [widgetSize, setWidgetSize] = useState<"small" | "large">("small");

  const slug = library?.slug || "your-library";
  const embedUrl = `${BASE_URL}/embed/${slug}?theme=${widgetTheme}&size=${widgetSize}`;
  const iframeCode = `<iframe src="${embedUrl}" width="${widgetSize === "small" ? 320 : 480}" height="${widgetSize === "small" ? 180 : 320}" frameborder="0" style="border-radius:12px;border:1px solid #333;"></iframe>`;
  const markdownBadge = `[![My Board Game Library on GameTaverns](${BASE_URL}/api/badge/${slug})](${BASE_URL}/?tenant=${slug})`;

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success(t('embedWidget.copied'));
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isAuthenticated) {
    return (
      <Layout hideSidebar>
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('embedWidget.signInRequired')}</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <SEO title={t('embedWidget.title')} description={t('embedWidget.subtitle')} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-2">{t('embedWidget.title')}</h1>
          <p className="text-muted-foreground">{t('embedWidget.subtitle')}</p>
        </div>

        {!library ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('embedWidget.createLibraryFirst')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('embedWidget.widgetSettings')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">{t('embedWidget.theme')}</Label>
                    <div className="flex gap-2 mt-1" role="radiogroup" aria-label={t('embedWidget.theme')}>
                      {(["dark", "light"] as const).map((thm) => (
                        <button
                          key={thm}
                          role="radio"
                          aria-checked={widgetTheme === thm}
                          onClick={() => setWidgetTheme(thm)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors capitalize ${
                            widgetTheme === thm
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {t(`embedWidget.${thm}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">{t('embedWidget.size')}</Label>
                    <div className="flex gap-2 mt-1" role="radiogroup" aria-label={t('embedWidget.size')}>
                      {(["small", "large"] as const).map((s) => (
                        <button
                          key={s}
                          role="radio"
                          aria-checked={widgetSize === s}
                          onClick={() => setWidgetSize(s)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors capitalize ${
                            widgetSize === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {t(`embedWidget.${s}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('embedWidget.preview')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`rounded-xl border p-5 ${
                    widgetTheme === "dark"
                      ? "bg-slate-900 border-slate-700 text-slate-100"
                      : "bg-white border-slate-200 text-slate-900"
                  }`}
                  style={{ maxWidth: widgetSize === "small" ? 320 : 480 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white text-xs font-bold">GT</div>
                    <div>
                      <div className="font-bold text-sm">{library.name}</div>
                      <div className={`text-xs ${widgetTheme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        {t('embedWidget.onGameTaverns')}
                      </div>
                    </div>
                  </div>
                  {widgetSize === "large" && (
                    <p className={`text-xs mb-3 ${widgetTheme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      {t('embedWidget.browseCollection')}
                    </p>
                  )}
                  <a
                    href={`${BASE_URL}/?tenant=${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      widgetTheme === "dark" ? "text-amber-400 hover:text-amber-300" : "text-amber-600 hover:text-amber-700"
                    }`}
                  >
                    {t('embedWidget.visitLibrary')} <ExternalLink className="h-3 w-3" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  {t('embedWidget.embedCode')}
                </CardTitle>
                <CardDescription>{t('embedWidget.embedCodeDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="iframe">
                  <TabsList>
                    <TabsTrigger value="iframe">{t('embedWidget.htmlIframe')}</TabsTrigger>
                    <TabsTrigger value="markdown">{t('embedWidget.markdown')}</TabsTrigger>
                    <TabsTrigger value="link">{t('embedWidget.directLink')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="iframe" className="mt-3">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">{iframeCode}</pre>
                      <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleCopy(iframeCode, "iframe")} aria-label="Copy iframe code">
                        {copied === "iframe" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="markdown" className="mt-3">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">{markdownBadge}</pre>
                      <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleCopy(markdownBadge, "markdown")} aria-label="Copy markdown code">
                        {copied === "markdown" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="link" className="mt-3">
                    <div className="relative">
                      <Input readOnly value={`${BASE_URL}/?tenant=${slug}`} className="font-mono text-sm pr-12" />
                      <Button variant="outline" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleCopy(`${BASE_URL}/?tenant=${slug}`, "link")} aria-label="Copy direct link">
                        {copied === "link" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
