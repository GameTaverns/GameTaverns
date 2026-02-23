import { useState } from "react";
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
    toast.success("Copied!");
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isAuthenticated) {
    return (
      <Layout hideSidebar>
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in to get your embed code</h1>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideSidebar>
      <SEO title="Embed Your Library" description="Add a GameTaverns widget to your blog, Discord, or forum to showcase your board game collection." />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold mb-2">Embed Your Library</h1>
          <p className="text-muted-foreground">
            Showcase your collection on your blog, Discord server, or forum. Every widget links back to your library.
          </p>
        </div>

        {!library ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Create a library first to generate your embed code.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Widget Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Theme</Label>
                    <div className="flex gap-2 mt-1">
                      {(["dark", "light"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setWidgetTheme(t)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors capitalize ${
                            widgetTheme === t
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Size</Label>
                    <div className="flex gap-2 mt-1">
                      {(["small", "large"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setWidgetSize(s)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors capitalize ${
                            widgetSize === s
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`rounded-xl border p-5 ${
                    widgetTheme === "dark"
                      ? "bg-slate-900 border-slate-700 text-slate-100"
                      : "bg-white border-slate-200 text-slate-900"
                  }`}
                  style={{
                    maxWidth: widgetSize === "small" ? 320 : 480,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
                      GT
                    </div>
                    <div>
                      <div className="font-bold text-sm">{library.name}</div>
                      <div className={`text-xs ${widgetTheme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        on GameTaverns
                      </div>
                    </div>
                  </div>
                  {widgetSize === "large" && (
                    <p className={`text-xs mb-3 ${widgetTheme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      Browse my board game collection, borrow games, and join game nights.
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
                    Visit Library <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Code tabs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Embed Code
                </CardTitle>
                <CardDescription>Copy and paste into your website, blog, or README.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="iframe">
                  <TabsList>
                    <TabsTrigger value="iframe">HTML / iframe</TabsTrigger>
                    <TabsTrigger value="markdown">Markdown</TabsTrigger>
                    <TabsTrigger value="link">Direct Link</TabsTrigger>
                  </TabsList>

                  <TabsContent value="iframe" className="mt-3">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
                        {iframeCode}
                      </pre>
                      <Button
                        variant="outline" size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => handleCopy(iframeCode, "iframe")}
                      >
                        {copied === "iframe" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="markdown" className="mt-3">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap break-all">
                        {markdownBadge}
                      </pre>
                      <Button
                        variant="outline" size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => handleCopy(markdownBadge, "markdown")}
                      >
                        {copied === "markdown" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="link" className="mt-3">
                    <div className="relative">
                      <Input
                        readOnly
                        value={`${BASE_URL}/?tenant=${slug}`}
                        className="font-mono text-sm pr-12"
                      />
                      <Button
                        variant="outline" size="icon"
                        className="absolute top-1 right-1 h-7 w-7"
                        onClick={() => handleCopy(`${BASE_URL}/?tenant=${slug}`, "link")}
                      >
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
