import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // CRITICAL: Redirect the auto-generated Supabase client to our self-hosted-aware version
      // This prevents the Lovable-generated client from crashing in self-hosted mode
      "@/integrations/supabase/client": path.resolve(__dirname, "./src/integrations/backend/client.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate heavy charting library
          "recharts": ["recharts"],
          // Separate animation library
          "framer-motion": ["framer-motion"],
          // Separate React Query
          "react-query": ["@tanstack/react-query"],
          // Separate UI primitives
          "radix-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));
