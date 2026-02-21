import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // For native (android/ios) builds: force Lovable Cloud credentials to empty strings.
    // The runtime override in getSupabaseConfig() (Capacitor.isNativePlatform()) will
    // use the hardcoded gametaverns.com values instead. This prevents any accidental
    // Lovable Cloud URL from being baked into the APK/IPA bundle.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      (mode === "android" || mode === "ios") ? "" : (env.VITE_SUPABASE_URL || "")
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      (mode === "android" || mode === "ios") ? "" : (env.VITE_SUPABASE_PUBLISHABLE_KEY || "")
    ),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "recharts": ["recharts"],
          "framer-motion": ["framer-motion"],
          "react-query": ["@tanstack/react-query"],
          "tiptap": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-underline",
            "@tiptap/extension-image",
            "@tiptap/extension-placeholder",
          ],
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
