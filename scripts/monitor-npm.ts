/**
 * monitor-npm.ts
 *
 * Tracks npm download stats and health for agentic-control packages.
 */

async function getStats(packageName: string) {
  try {
    const response = await fetch(`https://api.npmjs.org/downloads/point/last-month/${packageName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stats for ${packageName}: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      downloads: number;
      start: string;
      end: string;
      package: string;
    };
    return data;
  } catch (error) {
    console.error(`Error fetching stats for ${packageName}:`, error);
    return null;
  }
}

async function getRegistryData(packageName: string) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName.replace('/', '%2f')}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch registry data for ${packageName}: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      'dist-tags': { latest: string };
      license: string;
      time: { modified: string };
    };
    return {
      version: data['dist-tags'].latest,
      license: data.license,
      lastModified: data.time.modified,
    };
  } catch (error) {
    console.error(`Error fetching registry data for ${packageName}:`, error);
    return null;
  }
}

async function main() {
  const packages = ['agentic-control', 'vitest-agentic-control'];

  console.log('📦 NPM Package Health Report\n');
  console.log(`Generated on: ${new Date().toISOString()}\n`);

  for (const pkg of packages) {
    console.log(`--- ${pkg} ---`);
    const stats = await getStats(pkg);
    const registry = await getRegistryData(pkg);

    if (registry) {
      console.log(`Latest Version:  ${registry.version}`);
      console.log(`License:         ${registry.license}`);
      console.log(`Last Modified:   ${registry.lastModified}`);
    }

    if (stats) {
      console.log(`Monthly Downloads: ${stats.downloads}`);
    }
    console.log('');
  }
}

main().catch(console.error);
