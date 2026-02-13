import { useState, useEffect } from "react";
import { Download, Smartphone, Monitor, Share, Plus, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logoImage from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen parchment-texture flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-4">
          <img src={logoImage} alt="GameTaverns" className="h-16 w-auto mx-auto" />
          <h1 className="font-display text-3xl font-bold text-foreground">
            Install GameTaverns
          </h1>
          <p className="text-muted-foreground">
            Add GameTaverns to your home screen for the best experience — offline access, fast loading, and native app feel.
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-8 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-primary mx-auto" />
              <h2 className="font-display text-xl font-semibold">Already Installed!</h2>
              <p className="text-muted-foreground text-sm">
                GameTaverns is installed on this device. Open it from your home screen.
              </p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card>
            <CardContent className="py-6 space-y-4">
              <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                <Download className="h-5 w-5" />
                Install Now
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No app store needed — installs directly from your browser
              </p>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Install on iPhone / iPad</CardTitle>
              <CardDescription>Follow these steps in Safari:</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">1</div>
                <div>
                  <p className="font-medium text-sm">Tap the Share button</p>
                  <p className="text-xs text-muted-foreground">The square with an arrow at the bottom of Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">2</div>
                <div>
                  <p className="font-medium text-sm">Scroll down and tap "Add to Home Screen"</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Look for the <Plus className="h-3 w-3" /> icon
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm flex-shrink-0">3</div>
                <div>
                  <p className="font-medium text-sm">Tap "Add"</p>
                  <p className="text-xs text-muted-foreground">GameTaverns will appear on your home screen</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Install on your device</CardTitle>
              <CardDescription>Use your browser's menu to install</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Look for "Install app", "Add to Home Screen", or a <Download className="h-4 w-4 inline" /> icon in your browser's menu or address bar.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Features list */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-card border space-y-1">
            <Smartphone className="h-5 w-5 mx-auto text-primary" />
            <p className="text-xs font-medium">Works Offline</p>
          </div>
          <div className="p-3 rounded-lg bg-card border space-y-1">
            <Monitor className="h-5 w-5 mx-auto text-primary" />
            <p className="text-xs font-medium">Fast Loading</p>
          </div>
          <div className="p-3 rounded-lg bg-card border space-y-1">
            <Share className="h-5 w-5 mx-auto text-primary" />
            <p className="text-xs font-medium">No App Store</p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/" className="underline hover:text-foreground transition-colors">
            Continue in browser instead
          </a>
        </p>
      </div>
    </div>
  );
}
