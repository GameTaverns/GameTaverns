import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: unknown) {
    // Surface in console in DEV for quick debugging
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6">
            <h1 className="font-display text-xl font-semibold text-foreground">App failed to load</h1>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.message}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Try a hard refresh. If it persists, open History and restore the last working version.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
