const path = require("path");

const DEFAULT_MODEL = "current_index_selector";

function getOption(argv, name, fallback = "") {
  const index = argv.indexOf(name);
  return index < 0 || index + 1 >= argv.length
    ? fallback
    : argv[index + 1];
}

function sanitizeFilePart(value, fallback) {
  const sanitized = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  return sanitized || fallback;
}

function parseCliOptions(argv, projectRoot) {
  const defaultInput = path.join(projectRoot, "tests", "fixtures", "model_test_cases_30.json");
  const defaultOutputDir = path.join(projectRoot, "results", "scenario_matching");
  const positionalInput = argv.slice(2).find(value => !value.startsWith("--"));
  const requestedModelName = getOption(argv, "--model", DEFAULT_MODEL);

  return {
    inputPath: path.resolve(positionalInput || defaultInput),
    outputDir: path.resolve(getOption(argv, "--output-dir", defaultOutputDir)),
    requestedModelName,
    modelName: sanitizeFilePart(requestedModelName, DEFAULT_MODEL),
    overwriteGold: argv.includes("--overwrite-gold")
  };
}

module.exports = { parseCliOptions, sanitizeFilePart };
