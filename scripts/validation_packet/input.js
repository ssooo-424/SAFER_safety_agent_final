const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function getOption(argv, name, fallback = "") {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length
    ? argv[index + 1]
    : fallback;
}

function getOptions(argv, name) {
  const values = [];
  for (let index = 2; index < argv.length; index++) {
    if (argv[index] === name && argv[index + 1]) {
      values.push(argv[index + 1]);
      index++;
    }
  }
  return values;
}

function resolveOptions(argv, defaults) {
  const requestedResults = getOptions(argv, "--result");
  return {
    inputPath: path.resolve(getOption(argv, "--input", defaults.input)),
    scenarioPath: path.resolve(getOption(argv, "--scenarios", defaults.scenarios)),
    outputDir: path.resolve(getOption(argv, "--output-dir", defaults.outputDir)),
    publicBundlePath: path.resolve(
      getOption(argv, "--public-bundle", defaults.publicBundle)
    ),
    resultPaths: requestedResults.length > 0
      ? requestedResults.map(item => path.resolve(item))
      : fs.existsSync(defaults.baseline)
        ? [defaults.baseline]
        : []
  };
}

function assertFilesExist(filePaths) {
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`필요한 파일이 없습니다: ${filePath}`);
    }
  }
}

module.exports = { assertFilesExist, readJson, resolveOptions, writeJson };
