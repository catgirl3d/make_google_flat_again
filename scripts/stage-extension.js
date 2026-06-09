const { stageExtension } = require("./package-extension.js");

function parseArgs(argv) {
  const [target, mode] = argv;

  if (!target || !mode) {
    throw new Error("Usage: node scripts/stage-extension.js <firefox|chrome> <dev|prod>");
  }

  return {
    target,
    mode
  };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { stageDir } = stageExtension(options);
    console.log(`Prepared ${options.target} ${options.mode} stage: ${stageDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  parseArgs
};
