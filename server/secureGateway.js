import http from "node:http";
import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, "..");

function fail(message) {
  throw new Error(`RSOS secure gateway startup failed: ${message}`);
}

function getEnv(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureHttpsOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") fail("RSOS_PUBLIC_ORIGIN must use https://");
    return parsed;
  } catch {
    fail("RSOS_PUBLIC_ORIGIN must be a valid https URL");
  }
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return map[ext] || "application/octet-stream";
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self';");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
}

function normalizePathname(rawPathname = "/") {
  return String(rawPathname || "/").split("?")[0].split("#")[0];
}

function isDeniedStaticPath(pathname) {
  if (pathname.startsWith("/.") || pathname.includes("/.") || pathname.endsWith(".env")) return true;
  if (pathname.startsWith("/backups") || pathname.startsWith("/checkpoints") || pathname.startsWith("/server") || pathname.startsWith("/scripts")) return true;
  if (pathname.endsWith(".map") && getEnv("RSOS_ENABLE_PUBLIC_SOURCEMAPS", "false") !== "true") return true;
  return false;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForBackendHealth(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 2000 }, (res) => {
          resolve(Number(res.statusCode || 0));
        });
        req.on("error", reject);
        req.on("timeout", () => req.destroy(new Error("timeout")));
      });
      if (status >= 200 && status < 300) return;
    } catch {
      // keep retrying until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  fail("Internal API backend did not become healthy in time");
}

async function main() {
  if (getEnv("NODE_ENV") !== "production") {
    fail("NODE_ENV must be production");
  }

  const publicOrigin = ensureHttpsOrigin(getEnv("RSOS_PUBLIC_ORIGIN"));
  const httpsPort = parsePort(getEnv("RSOS_HTTPS_PORT", String(publicOrigin.port || 443)), 443);
  const httpRedirectPort = parsePort(getEnv("RSOS_HTTP_REDIRECT_PORT", "80"), 80);
  const internalApiPort = parsePort(getEnv("RSOS_INTERNAL_API_PORT", "3001"), 3001);
  const dataDir = getEnv("RSOS_DATA_DIR");
  const backupDir = getEnv("RSOS_BACKUP_DIR", path.join(projectRootDir, "backups"));
  const tlsKeyPath = getEnv("RSOS_TLS_KEY_PATH");
  const tlsCertPath = getEnv("RSOS_TLS_CERT_PATH");
  const frontendDistDir = getEnv("RSOS_FRONTEND_DIST", path.join(projectRootDir, "app", "dist"));

  if (!dataDir) fail("RSOS_DATA_DIR is required");
  if (!tlsKeyPath) fail("RSOS_TLS_KEY_PATH is required");
  if (!tlsCertPath) fail("RSOS_TLS_CERT_PATH is required");

  const [hasDist, hasIndex, hasTlsKey, hasTlsCert] = await Promise.all([
    fileExists(frontendDistDir),
    fileExists(path.join(frontendDistDir, "index.html")),
    fileExists(tlsKeyPath),
    fileExists(tlsCertPath),
  ]);
  if (!hasDist || !hasIndex) fail("Frontend production build was not found. Run npm run build first.");
  if (!hasTlsKey) fail("TLS key file not found");
  if (!hasTlsCert) fail("TLS certificate file not found");

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(backupDir, { recursive: true });

  const backendEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(internalApiPort),
    RSOS_BIND_HOST: "127.0.0.1",
    RSOS_DATA_DIR: dataDir,
    RSOS_BACKUP_DIR: backupDir,
    RSOS_ALLOWED_ORIGINS: publicOrigin.origin,
  };

  const backendProcess = spawn(process.execPath, [path.join(projectRootDir, "server", "index.js")], {
    cwd: projectRootDir,
    env: backendEnv,
    stdio: "inherit",
  });

  backendProcess.on("exit", (code) => {
    if (code !== 0) {
      process.exit(code || 1);
    }
  });

  const backendHealthUrl = `http://127.0.0.1:${internalApiPort}/api/health`;
  await waitForBackendHealth(backendHealthUrl);

  const tlsOptions = {
    key: await fs.readFile(tlsKeyPath, "utf8"),
    cert: await fs.readFile(tlsCertPath, "utf8"),
  };

  const proxyToBackend = (req, res) => {
    const targetUrl = new URL(req.url || "/", `http://127.0.0.1:${internalApiPort}`);
    const proxyRequest = http.request(
      {
        hostname: "127.0.0.1",
        port: internalApiPort,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${internalApiPort}`,
          "x-forwarded-proto": "https",
          "x-forwarded-host": publicOrigin.host,
        },
      },
      (proxyResponse) => {
        res.writeHead(Number(proxyResponse.statusCode || 502), proxyResponse.headers);
        proxyResponse.pipe(res);
      },
    );

    proxyRequest.on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Upstream backend unavailable" }));
    });

    req.pipe(proxyRequest);
  };

  const httpsServer = https.createServer(tlsOptions, async (req, res) => {
    try {
      applySecurityHeaders(res);
      const pathname = normalizePathname(req.url || "/");

      if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, status: "ok", service: "rsos-secure-gateway", timestamp: new Date().toISOString() }));
        return;
      }

      if (pathname.startsWith("/api/")) {
        proxyToBackend(req, res);
        return;
      }

      if (isDeniedStaticPath(pathname)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const requestedPath = pathname === "/" ? "/index.html" : pathname;
      const resolved = path.join(frontendDistDir, path.normalize(requestedPath).replace(/^\/+/, ""));
      const withinDist = resolved.startsWith(path.resolve(frontendDistDir));
      if (!withinDist) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      const servePath = (await fileExists(resolved)) ? resolved : path.join(frontendDistDir, "index.html");
      const data = await fs.readFile(servePath);
      res.writeHead(200, { "Content-Type": mimeTypeFor(servePath) });
      res.end(data);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Secure gateway error" }));
    }
  });

  const redirectServer = http.createServer((req, res) => {
    const requestHost = String(req.headers.host || publicOrigin.host).split(":")[0];
    const destination = `${publicOrigin.protocol}//${requestHost}${publicOrigin.port ? `:${publicOrigin.port}` : ""}${req.url || "/"}`;
    res.writeHead(308, { Location: destination });
    res.end();
  });

  httpsServer.listen(httpsPort, () => {
    console.log(`[rsos-secure] HTTPS gateway listening on ${httpsPort}`);
  });

  redirectServer.listen(httpRedirectPort, () => {
    console.log(`[rsos-secure] HTTP redirect listening on ${httpRedirectPort}`);
  });

  const shutdown = () => {
    redirectServer.close(() => undefined);
    httpsServer.close(() => undefined);
    backendProcess.kill("SIGTERM");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
