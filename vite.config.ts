// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false, // served from public/manifest.webmanifest
        devOptions: { enabled: false },
        filename: "sw.js",
        outDir: "dist/client",
        workbox: {
          navigateFallback: null,
          globPatterns: ["**/*.{js,css,png,svg,ico,webmanifest,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: { cacheName: "pages", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
              handler: "CacheFirst",
              options: { cacheName: "assets", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
            },
            {
              // Campus data: buildings, waypoints, paths, rooms, settings
              urlPattern: ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/rest/v1/"),
              handler: "NetworkFirst",
              options: { cacheName: "campus-data", networkTimeoutSeconds: 4, expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 14 } },
            },
            {
              // Map backgrounds and floor-plan images (signed URLs) — ignore token query
              urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/"),
              handler: "CacheFirst",
              options: {
                cacheName: "campus-images",
                matchOptions: { ignoreSearch: true },
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url }) => url.origin.includes("fonts.googleapis.com") || url.origin.includes("fonts.gstatic.com"),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "fonts" },
            },
          ],
        },
      }),
    ],
  },
});
