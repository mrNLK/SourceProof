import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Serve static HTML files from public/ before SPA fallback rewrites them
function serveStaticHtml(): Plugin {
  return {
    name: "serve-static-html",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        // Serve /poster or /poster.html directly from public/
        if (url === "/poster" || url === "/poster.html") {
          const filePath = path.join(__dirname, "public", "poster.html");
          if (fs.existsSync(filePath)) {
            res.setHeader("Content-Type", "text/html");
            res.setHeader("Cache-Control", "no-store");
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [serveStaticHtml(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query"],
          "ui-vendor": ["lucide-react"],
        },
      },
    },
  },
}));
