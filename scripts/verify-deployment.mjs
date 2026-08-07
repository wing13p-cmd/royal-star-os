import { readFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = process.env.RSOS_FRONTEND_DIST ? path.resolve(process.env.RSOS_FRONTEND_DIST) : path.join(rootDir, "app", "dist");
const manifestPath = path.join(distDir, "manifest.webmanifest");
const swPath = path.join(distDir, "sw.js");

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

async function collectFiles(dirPath) {
  const files = [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

async function main() {
  await access(distDir);
  await access(manifestPath);
  await access(swPath);

  const allFiles = await collectFiles(distDir);
  const textFiles = allFiles.filter((filePath) => /\.(html|js|css|json|webmanifest|txt)$/i.test(filePath));

  let bundleContent = "";
  for (const filePath of textFiles) {
    bundleContent += `\n${await readFile(filePath, "utf8")}`;
  }

  assertTrue(!/localhost/i.test(bundleContent), "Production bundle contains localhost reference");
  assertTrue(!/127\.0\.0\.1/i.test(bundleContent), "Production bundle contains 127.0.0.1 reference");
  assertTrue(!/http:\/\/(?!www\.w3\.org)/i.test(bundleContent), "Production bundle contains insecure http:// reference");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assertTrue(manifest.name === "Royal Star Operating System", "Manifest name is invalid");
  assertTrue(manifest.short_name === "RSOS", "Manifest short_name is invalid");
  assertTrue(manifest.display === "standalone", "Manifest display mode must be standalone");
  assertTrue(manifest.start_url, "Manifest start_url is required");
  assertTrue(manifest.scope, "Manifest scope is required");

  const requiredIcons = [
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-192.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png",
  ];

  for (const iconPath of requiredIcons) {
    await access(path.join(distDir, iconPath));
  }

  console.log("PASS");
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
