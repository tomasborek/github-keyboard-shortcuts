#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const FILES = ["manifest.json", "config.js", "content.js"];

const buildsDir = resolve(root, "builds");
mkdirSync(buildsDir, { recursive: true });

const zipName = `${pkg.name}-${pkg.version}.zip`;
const zipPath = resolve(buildsDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

execFileSync("zip", ["-X", zipPath, ...FILES], {
  cwd: root,
  stdio: "inherit",
});

console.log(`Built builds/${zipName}`);
