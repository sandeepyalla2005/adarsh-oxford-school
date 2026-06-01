import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  cacheDir: "node_modules/.vite-" + mode,
  server: {
    host: "0.0.0.0",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  preview: {
    allowedHosts: ["oxford-school-pkc2.onrender.com"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    outDir: mode === "admin" ? "dist-admin" : mode === "staff" ? "dist-staff" : mode === "fee" ? "dist-fee" : "dist",
    rollupOptions: {
      input:
        mode === "admin"
          ? path.resolve(__dirname, "admin.html")
          : mode === "staff"
            ? path.resolve(__dirname, "staff.html")
            : mode === "fee"
              ? path.resolve(__dirname, "fee.html")
            : path.resolve(__dirname, "index.html"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
