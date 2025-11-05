import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        name: "Explore Crew",
        short_name: "ExploreCrew",
        description: "Share & explore with your crew",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#06b6d4",
        background_color: "#ffffff",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable any" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
        ],
        shortcuts: [
          { name: "Feed", url: "/feed" },
          { name: "Add Event", url: "/addevent" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/(sign|public)\/.+/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 }
            }
          },
          {
            urlPattern: /^https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.+/i,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ]
})
