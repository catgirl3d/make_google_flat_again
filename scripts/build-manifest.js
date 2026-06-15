const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..");
const MANIFESTS_DIR = path.join(PROJECT_ROOT, "manifests");
const SUPPORTED_TARGETS = new Set(["firefox", "chrome"]);
const CHROME_BROAD_GOOGLE_MATCH = "https://www.google.com/*";
const CHROME_NARROW_GOOGLE_WAR_MATCHES = new Set([
  "https://www.google.com/maps*",
  "https://www.google.com/maps/*"
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }

  return value;
}

function deepMerge(baseValue, overrideValue) {
  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    return cloneValue(overrideValue);
  }

  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const result = cloneValue(baseValue);

    for (const [key, value] of Object.entries(overrideValue)) {
      result[key] = Object.prototype.hasOwnProperty.call(baseValue, key)
        ? deepMerge(baseValue[key], value)
        : cloneValue(value);
    }

    return result;
  }

  return cloneValue(overrideValue);
}

function assertTarget(target) {
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Unsupported manifest target: ${target}`);
  }
}

function loadManifestFragment(targetName) {
  const filePath = path.join(MANIFESTS_DIR, `${targetName}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeChromeWebAccessibleResources(manifest) {
  if (!Array.isArray(manifest?.web_accessible_resources)) {
    return manifest;
  }

  manifest.web_accessible_resources = manifest.web_accessible_resources.map((entry) => {
    if (!Array.isArray(entry?.matches)) {
      return entry;
    }

    const normalizedMatches = [];
    let broadenGoogleOrigin = false;

    for (const matchPattern of entry.matches) {
      if (CHROME_NARROW_GOOGLE_WAR_MATCHES.has(matchPattern)) {
        broadenGoogleOrigin = true;
        continue;
      }

      if (!normalizedMatches.includes(matchPattern)) {
        normalizedMatches.push(matchPattern);
      }
    }

    if (broadenGoogleOrigin && !normalizedMatches.includes(CHROME_BROAD_GOOGLE_MATCH)) {
      normalizedMatches.push(CHROME_BROAD_GOOGLE_MATCH);
    }

    return {
      ...entry,
      matches: normalizedMatches
    };
  });

  return manifest;
}

function normalizeManifestForTarget(target, manifest) {
  if (target === "chrome") {
    return normalizeChromeWebAccessibleResources(manifest);
  }

  return manifest;
}

function buildManifest(target) {
  assertTarget(target);
  return normalizeManifestForTarget(target, deepMerge(loadManifestFragment("base"), loadManifestFragment(target)));
}

function writeManifest(target, outputDir) {
  assertTarget(target);

  if (!outputDir) {
    throw new Error("An output directory is required.");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "manifest.json");
  const manifest = buildManifest(target);
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    manifest,
    outputPath
  };
}

if (require.main === module) {
  const [, , target, outputDir] = process.argv;

  if (!target || !outputDir) {
    console.error("Usage: node scripts/build-manifest.js <firefox|chrome> <output-dir>");
    process.exit(1);
  }

  try {
    const { outputPath } = writeManifest(target, outputDir);
    console.log(`Built manifest: ${outputPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  MANIFESTS_DIR,
  PROJECT_ROOT,
  SUPPORTED_TARGETS,
  buildManifest,
  cloneValue,
  deepMerge,
  loadManifestFragment,
  normalizeChromeWebAccessibleResources,
  normalizeManifestForTarget,
  writeManifest
};
