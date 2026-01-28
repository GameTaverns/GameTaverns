import { Construction, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Maintenance() {
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
            <h1 className="text-2xl font-bold text-foreground">
              We'll Be Right Back
            </h1>
            <p className="text-muted-foreground">
              We're currently performing scheduled maintenance to improve your experience.
            </p>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Our team is working hard to bring you new features and improvements. 
              Please check back soon!
            </p>
          </div>
          
          <div className="pt-4">
            <p className="text-xs text-muted-foreground/70">
              If you're an administrator, please{" "}
              <a href="/login" className="text-primary hover:underline">
                log in
              </a>{" "}
              to access the site.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
