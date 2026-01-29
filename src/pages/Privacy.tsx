import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
          <Shield className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-bold">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: January 2025</p>
          </div>
        </div>

        <div className="prose prose-stone dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold border-b pb-2">1. Introduction</h2>
            <p>
              GameTaverns ("we," "our," or "us") is a hobby project that provides a platform 
              for board game enthusiasts to catalog and share their game collections. This 
              Privacy Policy explains how we collect, use, and protect your information when 
              you use our service.
            </p>
            <p>
              We are committed to protecting your privacy and handling your data transparently. 
              This policy applies to all users of GameTaverns, including library owners and 
              visitors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mt-4">Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address (required for account creation and login)</li>
              <li>Display name (optional, shown on your library)</li>
              <li>Profile information (optional bio and avatar)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">Library Data</h3>
            <p>When you create a library, we store:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Library name and description</li>
              <li>Board game collection data (titles, images, descriptions)</li>
              <li>Custom settings and theme preferences</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">Visitor Data</h3>
            <p>When visitors interact with libraries, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Game ratings and wishlist entries (anonymous identifier)</li>
              <li>Contact form submissions (name, email, message - encrypted)</li>
              <li>Poll votes (anonymous identifier)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4">Automatically Collected Data</h3>
            <p>We automatically collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP addresses (for security and rate limiting only)</li>
              <li>Device fingerprints (for fraud prevention)</li>
              <li>Basic usage analytics (page views, feature usage)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and maintain the GameTaverns service</li>
              <li>Authenticate users and secure accounts</li>
              <li>Enable library owners to manage their collections</li>
              <li>Facilitate communication between visitors and library owners</li>
              <li>Prevent abuse, fraud, and spam</li>
              <li>Improve the platform based on usage patterns</li>
              <li>Send important service notifications (no marketing emails)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">4. Data Sharing</h2>
            <p>
              <strong>We do not sell your data.</strong> We share information only in these cases:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>With library owners:</strong> Contact form submissions are shared with 
                the relevant library owner so they can respond to inquiries.
              </li>
              <li>
                <strong>Public data:</strong> Library information you mark as public (game 
                collections, ratings summaries) is visible to anyone.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose information if required 
                by law or to protect our rights.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">5. Data Security</h2>
            <p>We implement security measures including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Encryption of sensitive data (passwords, contact information)</li>
              <li>HTTPS encryption for all data transmission</li>
              <li>Row-level security to isolate library data</li>
              <li>Regular security audits and updates</li>
            </ul>
            <p>
              While we strive to protect your data, no method of transmission over the 
              Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete 
              your account:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your profile and library data will be permanently deleted</li>
              <li>Anonymous data (ratings, votes) may be retained for statistics</li>
              <li>Backups are purged within 30 days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate information</li>
              <li><strong>Erasure:</strong> Delete your account and associated data</li>
              <li><strong>Portability:</strong> Export your library data</li>
              <li><strong>Object:</strong> Opt out of non-essential data processing</li>
            </ul>
            <p>
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@gametaverns.com" className="text-primary hover:underline">
                privacy@gametaverns.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">8. International Users</h2>
            <p>
              GameTaverns is operated from [Your Location]. If you access the service from 
              outside this region, your data may be transferred to and processed in servers 
              located elsewhere. By using our service, you consent to this transfer.
            </p>
            <p>
              For EU/EEA users: We process data under legitimate interest for service 
              operation. You may contact us to exercise your GDPR rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">9. Children's Privacy</h2>
            <p>
              GameTaverns is not intended for children under 13. We do not knowingly 
              collect personal information from children. If you believe a child has 
              provided us with data, please contact us for removal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify users of 
              significant changes via email or a prominent notice on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">11. Contact Us</h2>
            <p>
              For privacy-related questions or concerns:
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
