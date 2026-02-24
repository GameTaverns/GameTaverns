import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const essentialCookies = [
  { name: "sb-*-auth-token", purpose: "Authentication session token", duration: "7 days", type: "Essential" },
  { name: "sb-*-auth-token-code-verifier", purpose: "PKCE security for OAuth flows", duration: "Session", type: "Essential" },
  { name: "theme", purpose: "Remember your light/dark mode preference", duration: "1 year", type: "Preference" },
];

const localStorageItems = [
  { name: "guest_identifier", purpose: "Anonymous identifier for ratings/wishlist", duration: "Permanent", type: "Functional" },
  { name: "guest_name", purpose: "Optional display name for votes", duration: "Permanent", type: "Functional" },
  { name: "demo_*", purpose: "Demo mode game data (not synced)", duration: "Permanent", type: "Functional" },
];

export default function Cookies() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        <div className="container max-w-4xl py-12 px-4">
          <Button variant="ghost" asChild className="mb-8">
            <Link to="/legal">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("legal.backToLegal")}
            </Link>
          </Button>

          <div className="flex items-center gap-4 mb-8">
            <Cookie className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">{t("legal.cookiePolicy")}</h1>
              <p className="text-muted-foreground">{t("legal.lastUpdatedFeb2026")}</p>
            </div>
          </div>

          <div className="prose prose-stone dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold border-b pb-2">1. What Are Cookies?</h2>
              <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">2. How We Use Cookies</h2>
              <p>GameTaverns uses a minimal set of cookies focused on essential functionality. We do not use cookies for advertising or third-party tracking.</p>
              <p>Our cookies fall into these categories:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Essential:</strong> Required for the site to function (login, security)</li>
                <li><strong>Preference:</strong> Remember your settings (theme choice)</li>
                <li><strong>Functional:</strong> Enable features like anonymous voting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">3. Cookies We Use</h2>
              <div className="not-prose">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cookie Name</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {essentialCookies.map((cookie) => (
                      <TableRow key={cookie.name}>
                        <TableCell className="font-mono text-sm">{cookie.name}</TableCell>
                        <TableCell>{cookie.purpose}</TableCell>
                        <TableCell>{cookie.duration}</TableCell>
                        <TableCell>{cookie.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">4. Local Storage</h2>
              <div className="not-prose">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localStorageItems.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell className="font-mono text-sm">{item.name}</TableCell>
                        <TableCell>{item.purpose}</TableCell>
                        <TableCell>{item.duration}</TableCell>
                        <TableCell>{item.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">5. Third-Party Cookies</h2>
              <p>We minimize third-party cookies. The following services may set their own cookies:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Cloudflare Turnstile:</strong> CAPTCHA verification on contact forms.</li>
                <li><strong>YouTube:</strong> Embedded game videos (if enabled by library owner).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">6. Managing Cookies</h2>
              <p>You can control cookies through your browser settings. Blocking essential cookies will prevent you from logging in.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">7. Do Not Track</h2>
              <p>GameTaverns respects "Do Not Track" browser signals. We do not track users across third-party websites.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2">8. Contact Us</h2>
              <p>If you have questions about our use of cookies:</p>
              <ul className="list-none space-y-1">
                <li>Email: <a href="mailto:admin@gametaverns.com" className="text-primary hover:underline">admin@gametaverns.com</a></li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
