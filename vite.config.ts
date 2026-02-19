import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["gt-logo.png", "favicon.ico"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "GameTaverns",
        short_name: "GameTaverns",
        description: "Create and explore board game libraries — track collections, events, lending, and more.",
        theme_color: "#3d6b45",
        background_color: "#f2ead9",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/gt-logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/gt-logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
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
