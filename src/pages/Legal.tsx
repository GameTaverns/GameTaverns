import { Link } from "react-router-dom";
import { FileText, Shield, Cookie, Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const legalPages = [
  {
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal data",
    icon: Shield,
    path: "/privacy",
  },
  {
    title: "Terms of Service",
    description: "Rules and guidelines for using GameTaverns",
    icon: Scale,
    path: "/terms",
  },
  {
    title: "Cookie Policy",
    description: "Information about cookies and tracking technologies",
    icon: Cookie,
    path: "/cookies",
  },
];

export default function Legal() {
  return (
    <div className="min-h-screen parchment-texture">
      <div className="container max-w-4xl py-16 px-4">
        <div className="text-center mb-12">
          <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-display font-bold mb-4">Legal Information</h1>
          <p className="text-lg text-muted-foreground">
            Important policies and terms governing your use of GameTaverns
          </p>
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
                  <CardDescription className="text-center">
                    {page.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Last updated: January 2025</p>
          <p className="mt-2">
            Questions about our policies?{" "}
            <a href="mailto:legal@gametaverns.com" className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
