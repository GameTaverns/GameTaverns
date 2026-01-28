import { AlertTriangle, Home, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LibrarySuspendedProps {
  libraryName?: string;
  suspensionReason?: string | null;
}

export default function LibrarySuspended({ libraryName, suspensionReason }: LibrarySuspendedProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Library Suspended</CardTitle>
          <CardDescription>
            {libraryName ? (
              <>
                <span className="font-medium text-foreground">{libraryName}</span> has been suspended.
              </>
            ) : (
              "This library has been suspended."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suspensionReason && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Reason for Suspension</AlertTitle>
              <AlertDescription className="mt-2">{suspensionReason}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground text-center">
            This library has been suspended for violating our terms of service or community guidelines.
            If you believe this is an error, please contact support.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
            <Button variant="outline" asChild>
              <a href="/">
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </a>
            </Button>
            <Button variant="default" asChild>
              <a href="mailto:support@gametaverns.com">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
