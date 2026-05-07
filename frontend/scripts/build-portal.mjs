import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const modeArg = process.argv[2] || "production";

const portalConfigs = {
  admin: {
    html: "admin.html",
    outDir: "dist-admin",
  },
  staff: {
    html: "staff.html",
    outDir: "dist-staff",
  },
  fee: {
    html: "fee.html",
    outDir: "dist-fee",
  },
  production: {
    html: "index.html",
    outDir: "dist",
  },
  development: {
    html: "index.html",
    outDir: "dist",
  },
};

const config = portalConfigs[modeArg] || portalConfigs.production;

function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnvFiles() {
  const env = {};
  const candidates = [".env", ".env.local", `.env.${modeArg}`, `.env.${modeArg}.local`];
  for (const fileName of candidates) {
    const filePath = path.join(rootDir, fileName);
    try {
      const content = await fs.readFile(filePath, "utf8");
      Object.assign(env, parseEnv(content));
    } catch {
      // Optional env file.
    }
  }
  return env;
}

function injectScript(html, scriptContent) {
  const scriptTag = `<script>window.__APP_ENV__ = ${scriptContent};</script>`;
  if (html.includes("window.__APP_ENV__")) return html;
  return html.replace("</head>", `  ${scriptTag}\n</head>`);
}

async function copyHtmlAsIndex(outDir, htmlFile) {
  const sourcePath = path.join(outDir, htmlFile);
  const indexPath = path.join(outDir, "index.html");
  const html = await fs.readFile(sourcePath, "utf8");
  await fs.writeFile(indexPath, html);
}

const env = await loadEnvFiles();
const outDir = path.join(rootDir, config.outDir);
const htmlPath = path.join(outDir, config.html);
let html = await fs.readFile(htmlPath, "utf8");

function injectPortalAttribute(html, portal) {
  if (html.includes("data-portal-build")) return html;
  return html.replace("<body", `<body data-portal-build="${portal}"`);
}

html = injectScript(
  html,
  JSON.stringify({
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || "",
    VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    VITE_API_BASE_URL: env.VITE_API_BASE_URL || "",
    VITE_MSG91_SENDER_ID: env.VITE_MSG91_SENDER_ID || "",
    VITE_MSG91_ENTITY_ID: env.VITE_MSG91_ENTITY_ID || "",
    VITE_MSG91_TEMPLATE_ID: env.VITE_MSG91_TEMPLATE_ID || "",
    VITE_PORTAL_MODE: modeArg,
  })
);

if (modeArg === "admin" || modeArg === "staff" || modeArg === "fee") {
  html = injectPortalAttribute(html, modeArg);
}

await fs.writeFile(htmlPath, html);
if (modeArg === "admin" || modeArg === "staff" || modeArg === "fee") {
  await copyHtmlAsIndex(outDir, config.html);
}
