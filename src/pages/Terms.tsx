import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
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
          <Scale className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-bold">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: February 2026</p>
          </div>
        </div>

        <div className="prose prose-stone dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold border-b pb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or using GameTaverns, you agree to be bound by these Terms of 
              Service. If you disagree with any part of these terms, you may not use our 
              service.
            </p>
            <p>
              GameTaverns is a hobby project providing a platform for board game enthusiasts 
              to catalog and share their game collections. The service is provided "as is" 
              without warranties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">2. Account Registration</h2>
            <p>To use certain features, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your password</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Not share your account credentials with others</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">3. Acceptable Use</h2>
            <p>When using GameTaverns, you agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Upload illegal, harmful, or offensive content</li>
              <li>Impersonate others or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorized access to the service</li>
              <li>Interfere with the service's operation or security</li>
              <li>Use automated tools to scrape or harvest data</li>
              <li>Spam other users or library visitors</li>
              <li>Violate intellectual property rights of others</li>
              <li>Use the service for commercial advertising without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">4. User Content</h2>
            <h3 className="text-lg font-medium mt-4">Your Rights</h3>
            <p>
              You retain ownership of content you create, including library descriptions, 
              game notes, and uploaded images. By posting content, you grant us a 
              non-exclusive license to display and distribute it through the service.
            </p>

            <h3 className="text-lg font-medium mt-4">Content Responsibility</h3>
            <p>
              You are responsible for ensuring your content doesn't infringe on others' 
              rights. Game images and descriptions from BoardGameGeek are used under their 
              terms and remain property of their respective owners.
            </p>

            <h3 className="text-lg font-medium mt-4">Content Removal</h3>
            <p>
              We may remove content that violates these terms or is reported as infringing. 
              You can delete your own content at any time through your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">5. Library Owner Responsibilities</h2>
            <p>As a library owner, you additionally agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Respond appropriately to visitor inquiries</li>
              <li>Not misuse contact information provided by visitors</li>
              <li>Keep your library content appropriate for all ages unless marked otherwise</li>
              <li>Not use your library primarily for commercial sales purposes</li>
              <li>Report any abuse or inappropriate behavior from visitors</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">6. Third-Party Services</h2>
            <p>
              GameTaverns integrates with third-party services including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>BoardGameGeek:</strong> For game data import and lookup</li>
              <li><strong>Discord:</strong> For optional community integration</li>
              <li><strong>Cloudflare:</strong> For security and performance</li>
            </ul>
            <p>
              Your use of these integrations is subject to their respective terms and 
              privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">7. Intellectual Property</h2>
            <p>
              The GameTaverns service, including its design, code, and branding, is 
              protected by intellectual property laws. You may not:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Copy, modify, or distribute our code without permission</li>
              <li>Use our branding to imply endorsement</li>
              <li>Create derivative works based on our service</li>
            </ul>
            <p>
              Board game names, images, and related content belong to their respective 
              publishers and are used for informational purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">8. Disclaimer of Warranties</h2>
            <p>
              GameTaverns is provided "AS IS" and "AS AVAILABLE" without warranties of 
              any kind, either express or implied, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Merchantability or fitness for a particular purpose</li>
              <li>Uninterrupted or error-free operation</li>
              <li>Accuracy or reliability of any information</li>
              <li>Security from unauthorized access</li>
            </ul>
            <p>
              As a hobby project, we cannot guarantee uptime, data preservation, or 
              continued operation of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, GameTaverns and its operators shall 
              not be liable for any indirect, incidental, special, consequential, or 
              punitive damages, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Loss of data or content</li>
              <li>Loss of profits or revenue</li>
              <li>Service interruptions</li>
              <li>Actions of other users</li>
            </ul>
            <p>
              Our total liability for any claim shall not exceed the amount you paid us 
              (if any) in the past 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">10. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless GameTaverns and its 
              operators from any claims, damages, or expenses arising from:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your use of the service</li>
              <li>Your violation of these terms</li>
              <li>Your content or library data</li>
              <li>Your violation of any third-party rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">11. Termination</h2>
            <p>
              We may terminate or suspend your access immediately, without prior notice, 
              for any reason, including breach of these terms.
            </p>
            <p>
              Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your right to use the service will cease immediately</li>
              <li>Your library will no longer be publicly accessible</li>
              <li>You may request export of your data for 30 days</li>
              <li>After 30 days, your data may be permanently deleted</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">12. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will provide 
              notice of significant changes via email or a prominent notice on the 
              platform. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">13. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with the laws 
              of the State of Florida, United States, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold border-b pb-2">14. Contact</h2>
            <p>
              For questions about these Terms of Service:
            </p>
            <ul className="list-none space-y-1">
              <li>Email: <a href="mailto:admin@gametaverns.com" className="text-primary hover:underline">admin@gametaverns.com</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
