const fs = require("node:fs");
const path = require("node:path");
const yazl = require("yazl");

const { PROJECT_ROOT, SUPPORTED_TARGETS, writeManifest } = require("./build-manifest.js");

const DIST_DIR = path.join(PROJECT_ROOT, "dist");
const ASSETS_PATH = path.join(PROJECT_ROOT, "assets");
const SRC_PATH = path.join(PROJECT_ROOT, "src");
const MANIFESTS_PATH = path.join(PROJECT_ROOT, "manifests");
const FIXED_ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0);
const STABLE_FILE_MODE = 0o100644;
const BUILD_MODES = new Set(["dev", "prod"]);
const BUILD_FLAGS_PATH = path.join("src", "shared", "build-flags.js");

function compareStrings(left, right) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function resolveDistDir(distDir) {
  return distDir == null ? DIST_DIR : distDir;
}

function assertTarget(target) {
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Unsupported package target: ${target}`);
  }
}

function assertMode(mode) {
  if (!BUILD_MODES.has(mode)) {
    throw new Error(`Unsupported build mode: ${mode}`);
  }
}

function assertRequiredPath(requiredPath) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing required path: ${requiredPath}`);
  }
}

function assertPackagingInputs() {
  for (const requiredPath of [ASSETS_PATH, SRC_PATH, MANIFESTS_PATH]) {
    assertRequiredPath(requiredPath);
  }
}

function assertSafeOutputName(outputName) {
  if (typeof outputName !== "string") {
    throw new Error("Output name must be a string.");
  }

  const normalizedOutputName = outputName.trim();

  if (!normalizedOutputName) {
    throw new Error("Output name must not be empty.");
  }

  if (
    path.posix.basename(normalizedOutputName) !== normalizedOutputName ||
    path.win32.basename(normalizedOutputName) !== normalizedOutputName ||
    normalizedOutputName === "." ||
    normalizedOutputName === ".."
  ) {
    throw new Error("Output name must be a plain filename without path separators.");
  }

  return normalizedOutputName;
}

function normalizeOutputName(target, outputName, manifestVersion) {
  let resolvedOutputName = outputName;

  if (!resolvedOutputName) {
    resolvedOutputName = target === "firefox"
      ? `classic-google-workspace-icons-${manifestVersion}-firefox.xpi`
      : `classic-google-workspace-icons-${manifestVersion}-chrome.zip`;
  }

  if (target === "firefox" && !resolvedOutputName.toLowerCase().endsWith(".xpi")) {
    resolvedOutputName = `${resolvedOutputName}.xpi`;
  }

  if (target === "chrome" && !resolvedOutputName.toLowerCase().endsWith(".zip")) {
    resolvedOutputName = `${resolvedOutputName}.zip`;
  }

  return resolvedOutputName;
}

function parseArgs(argv) {
  const [target, ...rest] = argv;

  if (!target) {
    throw new Error("Usage: node scripts/package-extension.js <firefox|chrome> [--output-name <filename>]");
  }

  let outputName;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--output-name") {
      const nextValue = rest[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --output-name.");
      }

      outputName = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output-name=")) {
      outputName = arg.slice("--output-name=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    target,
    outputName
  };
}

function prepareStage(target, distDir) {
  const resolvedDistDir = resolveDistDir(distDir);
  const stageDir = path.join(resolvedDistDir, `${target}-package`);

  fs.mkdirSync(resolvedDistDir, { recursive: true });
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  return stageDir;
}

function copyExtensionSources(stageDir) {
  fs.cpSync(ASSETS_PATH, path.join(stageDir, "assets"), { recursive: true, force: true });
  fs.cpSync(SRC_PATH, path.join(stageDir, "src"), { recursive: true, force: true });
}

function writeBuildFlags(stageDir, mode) {
  assertMode(mode);

  const buildFlagsPath = path.join(stageDir, BUILD_FLAGS_PATH);
  const currentSource = fs.readFileSync(buildFlagsPath, "utf8");
  const nextSource = currentSource.replace(
    /const DEFAULT_IS_DEVELOPMENT = (true|false);/,
    `const DEFAULT_IS_DEVELOPMENT = ${mode === "dev" ? "true" : "false"};`
  );

  if (nextSource === currentSource && !currentSource.includes(`const DEFAULT_IS_DEVELOPMENT = ${mode === "dev" ? "true" : "false"};`)) {
    throw new Error(`Unable to update build flags in: ${buildFlagsPath}`);
  }

  fs.writeFileSync(buildFlagsPath, nextSource, "utf8");
}

function pruneTargetFiles(target, stageDir) {
  if (target === "firefox") {
    fs.rmSync(path.join(stageDir, "src", "platform", "chrome"), { recursive: true, force: true });
    fs.rmSync(path.join(stageDir, "src", "background", "background-chrome.js"), { force: true });
    return;
  }

  if (target === "chrome") {
    fs.rmSync(path.join(stageDir, "src", "platform", "firefox"), { recursive: true, force: true });
  }
}

function toArchivePath(stageDir, absolutePath) {
  return path.relative(stageDir, absolutePath).split(path.sep).join("/");
}

function collectStageFiles(stageDir, currentDir = stageDir, collectedFiles = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    .sort((left, right) => compareStrings(left.name, right.name));

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      collectStageFiles(stageDir, absolutePath, collectedFiles);
      continue;
    }

    if (entry.isFile()) {
      collectedFiles.push({
        absolutePath,
        archivePath: toArchivePath(stageDir, absolutePath)
      });
      continue;
    }

    throw new Error(`Unsupported staged entry type: ${absolutePath}`);
  }

  return collectedFiles.sort((left, right) => compareStrings(left.archivePath, right.archivePath));
}

function writeDeterministicZip({ stageDir, outputPath }) {
  const tempOutputPath = `${outputPath}.tmp`;
  const stagedFiles = collectStageFiles(stageDir);

  fs.rmSync(tempOutputPath, { force: true });

  return new Promise((resolve, reject) => {
    const zipFile = new yazl.ZipFile();
    const writeStream = fs.createWriteStream(tempOutputPath);
    let settled = false;

    function finish(error) {
      if (settled) {
        return;
      }

      settled = true;

      if (error) {
        writeStream.destroy();
        fs.rmSync(tempOutputPath, { force: true });
        reject(error);
        return;
      }

      resolve({
        fileCount: stagedFiles.length,
        tempOutputPath
      });
    }

    zipFile.once("error", finish);
    zipFile.outputStream.once("error", finish);
    writeStream.once("error", finish);
    writeStream.once("close", () => finish());

    zipFile.outputStream.pipe(writeStream);

    for (const stagedFile of stagedFiles) {
      zipFile.addFile(stagedFile.absolutePath, stagedFile.archivePath, {
        compress: false,
        forceDosTimestamp: true,
        mode: STABLE_FILE_MODE,
        mtime: FIXED_ZIP_DATE
      });
    }

    zipFile.end();
  });
}

function stageExtension({ target, mode = "dev", distDir } = {}) {
  assertTarget(target);
  assertMode(mode);
  assertPackagingInputs();

  const stageDir = prepareStage(target, distDir);

  copyExtensionSources(stageDir);

  const { manifest } = writeManifest(target, stageDir);
  writeBuildFlags(stageDir, mode);
  pruneTargetFiles(target, stageDir);

  return {
    manifest,
    mode,
    stageDir
  };
}

async function packageExtension({ target, outputName, distDir } = {}) {
  const safeOutputName = outputName == null ? undefined : assertSafeOutputName(outputName);
  const resolvedDistDir = resolveDistDir(distDir);
  const { manifest, stageDir } = stageExtension({ target, mode: "prod", distDir: resolvedDistDir });

  const resolvedOutputName = normalizeOutputName(target, safeOutputName, manifest.version);
  const outputPath = path.join(resolvedDistDir, resolvedOutputName);

  fs.rmSync(outputPath, { force: true });

  const { fileCount, tempOutputPath } = await writeDeterministicZip({ stageDir, outputPath });

  fs.renameSync(tempOutputPath, outputPath);

  return {
    fileCount,
    manifest,
    outputPath,
    stageDir
  };
}

if (require.main === module) {
  (async () => {
    try {
      const options = parseArgs(process.argv.slice(2));
      const { fileCount, outputPath, stageDir } = await packageExtension(options);
      console.log(`Built ${options.target} package: ${outputPath}`);
      console.log(`Archived ${fileCount} files from: ${stageDir}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  })();
}

module.exports = {
  DIST_DIR,
  FIXED_ZIP_DATE,
  STABLE_FILE_MODE,
  assertMode,
  assertSafeOutputName,
  assertTarget,
  collectStageFiles,
  normalizeOutputName,
  packageExtension,
  parseArgs,
  pruneTargetFiles,
  stageExtension,
  writeBuildFlags,
  writeDeterministicZip
};
