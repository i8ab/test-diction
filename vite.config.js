import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import loginHandler from "./api/login.js";
import jsonbinHandler from "./api/jsonbin.js";

// Always resolve to the folder this config file lives in, not
// process.cwd() — cwd depends on where `npm run dev` was launched from
// (a parent folder, an IDE run-config, etc.) and if it's ever not the
// project root, .env.local silently fails to load with no error.
const projectRoot = dirname(fileURLToPath(import.meta.url));

// The real API lives in /api/*.js as Vercel serverless functions — those
// only run when deployed to Vercel (or via `vercel dev`). Plain `vite`/
// `npm run dev` never starts a server for them, so /api/login and
// /api/jsonbin would 404 (or fall through to index.html) and every login
// attempt would fail no matter what code you typed.
//
// This plugin runs the same handler functions inside Vite's own dev
// server, so `npm run dev` works end-to-end locally. It's dev-only and
// has no effect on the real Vercel deployment.
function vercelApiDevPlugin(env) {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/api/login") && !req.url.startsWith("/api/jsonbin")) {
          return next();
        }

        // Vite loads .env files into `env`, not process.env — the handlers
        // read process.env directly (as they do on Vercel), so mirror it in.
        Object.assign(process.env, env);

        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (obj) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(obj));
        };

        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          req.body = body;
          try {
            if (req.url.startsWith("/api/login")) {
              await loginHandler(req, res);
            } else {
              await jsonbinHandler(req, res);
            }
          } catch (e) {
            res.status(500).json({ error: "Dev API error: " + e.message });
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const found = ["ACCESS_CODE", "JSONBIN_BIN_ID", "JSONBIN_MASTER_KEY"].filter((k) => env[k]);
  const missing = ["ACCESS_CODE", "JSONBIN_BIN_ID", "JSONBIN_MASTER_KEY"].filter((k) => !env[k]);
  console.log(`[vite.config] env loaded from ${projectRoot}`);
  console.log(`[vite.config]   found: ${found.join(", ") || "(none)"}`);
  if (missing.length) console.log(`[vite.config]   missing: ${missing.join(", ")} — check .env.local`);
  return {
    plugins: [react(), vercelApiDevPlugin(env)],
    build: {
      target: "es2018",
      sourcemap: false,
    },
  };
});