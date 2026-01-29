import { Link } from "react-router-dom";
import { ArrowLeft, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const essentialCookies = [
  {
    name: "sb-*-auth-token",
    purpose: "Authentication session token",
    duration: "7 days",
    type: "Essential",
  },
  {
    name: "sb-*-auth-token-code-verifier",
    purpose: "PKCE security for OAuth flows",
    duration: "Session",
    type: "Essential",
  },
  {
    name: "theme",
    purpose: "Remember your light/dark mode preference",
    duration: "1 year",
    type: "Preference",
  },
];

const localStorage = [
  {
    name: "guest_identifier",
    purpose: "Anonymous identifier for ratings/wishlist",
    duration: "Permanent",
    type: "Functional",
  },
  {
    name: "guest_name",
    purpose: "Optional display name for votes",
    duration: "Permanent",
    type: "Functional",
  },
  {
    name: "demo_*",
    purpose: "Demo mode game data (not synced)",
    duration: "Permanent",
    type: "Functional",
  },
];

export default function Cookies() {
  return (
    <div className="min-h-screen parchment-texture">
      <div className="container max-w-4xl py-12 px-4">
        <Button variant="ghost" asChild className="mb-8">
          <Link to="/legal">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Legal
          </Link>
        </Button>

        <div className="flex items-center gap-4 mb-8">
          <Cookie className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-bold">Cookie Policy</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>
        </div>

        <div className="prose prose-stone dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold border-b pb-2">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files stored on your device when you visit a website. 
              They help the site remember your preferences and improve your experience. 
              We also use similar technologies like local storage for some functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">2. How We Use Cookies</h2>
            <p>
              GameTaverns uses a minimal set of cookies focused on essential functionality. 
              We do not use cookies for advertising or third-party tracking.
            </p>
            <p>Our cookies fall into these categories:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Essential:</strong> Required for the site to function (login, security)</li>
              <li><strong>Preference:</strong> Remember your settings (theme choice)</li>
              <li><strong>Functional:</strong> Enable features like anonymous voting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">3. Cookies We Use</h2>
            <p className="mb-4">The following cookies may be set when you use GameTaverns:</p>
            
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
            <p className="mb-4">
              In addition to cookies, we use browser local storage for certain features:
            </p>
            
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
                  {localStorage.map((item) => (
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
            <p>
              We minimize third-party cookies. The following services may set their own 
              cookies when you use specific features:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Cloudflare Turnstile:</strong> CAPTCHA verification on contact forms. 
                See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cloudflare's Privacy Policy</a>.
              </li>
              <li>
                <strong>YouTube:</strong> Embedded game videos (if enabled by library owner). 
                See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">6. Managing Cookies</h2>
            <p>
              You can control cookies through your browser settings. Most browsers allow you to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>View and delete existing cookies</li>
              <li>Block cookies from specific or all sites</li>
              <li>Set preferences for different types of cookies</li>
              <li>Receive notifications when cookies are set</li>
            </ul>
            <p>
              <strong>Note:</strong> Blocking essential cookies will prevent you from logging 
              in and using authenticated features of GameTaverns.
            </p>

            <h3 className="text-lg font-medium mt-4">Browser-Specific Instructions</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Apple Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">7. Clearing Local Storage</h2>
            <p>
              To clear local storage data used by GameTaverns:
            </p>
            <ol className="list-decimal pl-6 space-y-1">
              <li>Open your browser's developer tools (F12)</li>
              <li>Go to the Application/Storage tab</li>
              <li>Find Local Storage and select the GameTaverns domain</li>
              <li>Delete the entries you wish to remove</li>
            </ol>
            <p>
              <strong>Note:</strong> Clearing your guest identifier will reset your anonymous 
              ratings and wishlist entries.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">8. Do Not Track</h2>
            <p>
              GameTaverns respects "Do Not Track" browser signals. We do not track users 
              across third-party websites and do not use tracking for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">9. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy to reflect changes in our practices or for 
              legal reasons. We will post any changes on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">10. Contact Us</h2>
            <p>
              If you have questions about our use of cookies:
            </p>
            <ul className="list-none space-y-1">
              <li>Email: <a href="mailto:privacy@gametaverns.com" className="text-primary hover:underline">privacy@gametaverns.com</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
