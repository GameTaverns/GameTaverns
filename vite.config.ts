import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // IMPORTANT:
  // Vite exposes env vars via import.meta.env at runtime, but our previous `define` block
  // was overwriting them using `process.env`, which is often empty in this environment.
  // That resulted in an empty backend URL/key → no data + auth failures.
  const env = loadEnv(mode, process.cwd(), "");

  return ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Ensure import.meta.env values are always defined (prevents undefined errors)
    // Use Vite's loadEnv() so we don't accidentally overwrite real values with empty strings.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL || ""),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
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
  });
});
