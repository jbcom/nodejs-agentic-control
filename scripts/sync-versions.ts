/**
 * sync-versions.ts
 *
 * Syncs the version from the root package.json to all workspace packages.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

function main() {
  const rootPkgPath = join(ROOT, 'package.json');
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
  const version = rootPkg.version;

  console.log(`Syncing version ${version} to all packages...`);

  const packagesDir = join(ROOT, 'packages');
  const packages = readdirSync(packagesDir);

  for (const pkgName of packages) {
    const pkgDir = join(packagesDir, pkgName);
    if (!statSync(pkgDir).isDirectory()) continue;

    const pkgJsonPath = join(pkgDir, 'package.json');
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      pkgJson.version = version;

      // Also update workspace dependencies if any
      if (pkgJson.dependencies) {
        for (const dep in pkgJson.dependencies) {
          if (pkgJson.dependencies[dep] === 'workspace:*') {
            // Keep workspace:* or update to exact version?
            // Usually workspace:* is preferred in source.
          }
        }
      }

      writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
      console.log(`✅ Updated ${pkgName} to ${version}`);
    } catch (e) {
      console.error(`❌ Failed to update ${pkgName}:`, e);
    }
  }
}

main();
