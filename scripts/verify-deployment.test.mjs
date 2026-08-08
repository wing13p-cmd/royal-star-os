import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { verifyDeployment } from "./verify-deployment.mjs";

async function createValidDistFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "rsos-deploy-verify-"));
  const distDir = path.join(root, "dist");
  const iconsDir = path.join(distDir, "icons");
  await mkdir(iconsDir, { recursive: true });

  await writeFile(path.join(distDir, "index.html"), "<!doctype html><html><head></head><body><div id='root'></div><script src='/assets/index.js'></script></body></html>", "utf8");
  await writeFile(path.join(distDir, "sw.js"), "self.addEventListener('fetch', () => {});", "utf8");
  await writeFile(path.join(distDir, "assets.js"), "const x='https://rsos.example.com/api';", "utf8");
  await writeFile(
    path.join(distDir, "manifest.webmanifest"),
    JSON.stringify({
      name: "Royal Star Operating System",
      short_name: "RSOS",
      display: "standalone",
      start_url: "/",
      scope: "/",
    }),
    "utf8",
  );

  const requiredIcons = [
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-192.png",
    "icon-maskable-512.png",
    "apple-touch-icon.png",
  ];

  await Promise.all(
    requiredIcons.map((fileName) => writeFile(path.join(iconsDir, fileName), "png-placeholder", "utf8")),
  );

  return { distDir };
}

test("verifyDeployment passes for a valid dist fixture", async () => {
  const fixture = await createValidDistFixture();
  const result = await verifyDeployment({ distDir: fixture.distDir });
  assert.equal(result.ok, true);
  assert.equal(result.distDir, fixture.distDir);
});

test("verifyDeployment blocks localhost references", async () => {
  const fixture = await createValidDistFixture();
  await writeFile(path.join(fixture.distDir, "assets.js"), "const x='http://localhost:3001/api';", "utf8");

  await assert.rejects(
    () => verifyDeployment({ distDir: fixture.distDir }),
    /localhost reference/i,
  );
});

test("verifyDeployment enforces required icons", async () => {
  const fixture = await createValidDistFixture();
  await writeFile(path.join(fixture.distDir, "icons", "icon-192.png"), "", "utf8");
  await writeFile(path.join(fixture.distDir, "manifest.webmanifest"), JSON.stringify({
    name: "Royal Star Operating System",
    short_name: "RSOS",
    display: "standalone",
    start_url: "/",
    scope: "/",
  }), "utf8");

  // Remove one required icon by making a fresh fixture path and not creating it.
  const incompleteRoot = await mkdtemp(path.join(os.tmpdir(), "rsos-deploy-verify-missing-icon-"));
  const incompleteDistDir = path.join(incompleteRoot, "dist");
  const incompleteIconsDir = path.join(incompleteDistDir, "icons");
  await mkdir(incompleteIconsDir, { recursive: true });

  await writeFile(path.join(incompleteDistDir, "index.html"), "<html></html>", "utf8");
  await writeFile(path.join(incompleteDistDir, "sw.js"), "self.addEventListener('fetch', () => {});", "utf8");
  await writeFile(path.join(incompleteDistDir, "assets.js"), "const x='https://rsos.example.com/api';", "utf8");
  await writeFile(path.join(incompleteDistDir, "manifest.webmanifest"), JSON.stringify({
    name: "Royal Star Operating System",
    short_name: "RSOS",
    display: "standalone",
    start_url: "/",
    scope: "/",
  }), "utf8");

  await writeFile(path.join(incompleteIconsDir, "icon-192.png"), "png-placeholder", "utf8");
  await writeFile(path.join(incompleteIconsDir, "icon-512.png"), "png-placeholder", "utf8");
  await writeFile(path.join(incompleteIconsDir, "icon-maskable-192.png"), "png-placeholder", "utf8");
  await writeFile(path.join(incompleteIconsDir, "icon-maskable-512.png"), "png-placeholder", "utf8");
  // Deliberately omit apple-touch-icon.png

  await assert.rejects(
    () => verifyDeployment({ distDir: incompleteDistDir }),
  );
});
