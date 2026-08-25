const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const publicDirectory = path.join(__dirname, "..", "public");

function readPublicFile(fileName) {
  return fs.readFileSync(path.join(publicDirectory, fileName), "utf8");
}

function namedFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);

  const openBrace = source.indexOf(") {", start) + 2;
  assert.notEqual(openBrace, 1, `${functionName} must open its function body`);
  let depth = 0;

  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`${functionName} must close its function body`);
}

test("active Korean-language surfaces preserve words while retaining safe wrapping", () => {
  const index = readPublicFile("index.css");
  const postSurvey = readPublicFile("post-survey.css");
  const scenarioReview = readPublicFile("scenario-review.css");
  const saferCss = [
    "foundation.css",
    "context-panel.css",
    "conversation.css",
  ].map((fileName) => readPublicFile(path.join("safer-styles", fileName))).join("\n");

  for (const [name, source] of Object.entries({ index, postSurvey, scenarioReview, saferCss })) {
    assert.match(source, /word-break\s*:\s*keep-all/i, `${name} must keep Korean words intact`);
    assert.match(source, /overflow-wrap\s*:\s*break-word/i, `${name} must safely wrap long unbroken values`);
  }

  for (const selector of [".context-facts dd", ".bubble"]) {
    const rule = saferCss.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{[^}]*\\}`, "s"));
    assert.ok(rule, `${selector} must have a dedicated wrapping rule`);
    assert.doesNotMatch(rule[0], /overflow-wrap\s*:\s*anywhere/i, `${selector} must not split Korean words anywhere`);
    assert.match(rule[0], /overflow-wrap\s*:\s*break-word/i, `${selector} must preserve a long-token escape hatch`);
  }
});

test("post-survey scales remain keyboard reachable and visibly focused", () => {
  const postSurvey = readPublicFile("post-survey.css");

  const radioRule = postSurvey.match(/\.scale-item input\s*\{[^}]*\}/s);
  assert.ok(radioRule, "scale radios must have an explicit visually-hidden rule");
  assert.doesNotMatch(radioRule[0], /display\s*:\s*none/i, "scale radios must stay in the tab order");
  assert.match(radioRule[0], /position\s*:\s*absolute/i);
  assert.match(radioRule[0], /opacity\s*:\s*0/i);
  assert.match(postSurvey, /\.scale-item input:focus-visible\s*\+\s*\.scale-num\s*\{[^}]*outline/i);
  assert.match(postSurvey, /input\[type="range"\]:focus-visible\s*\{[^}]*outline/i);
  assert.match(postSurvey, /--post-muted-readable\s*:\s*#[0-9a-f]{6}/i);
  assert.match(postSurvey, /--post-muted-strong\s*:\s*#[0-9a-f]{6}/i);
  assert.match(postSurvey, /\.scale-label\s*\{[^}]*color\s*:\s*var\(--post-muted-readable\)/i);
  assert.match(postSurvey, /\.slider-labels\s*\{[^}]*color\s*:\s*var\(--post-muted-strong\)/i);
});

test("scenario research controls keep a 44px field touch target", () => {
  const reviewCss = readPublicFile("scenario-review.css");

  for (const selector of [
    'input[type="text"], select, textarea',
    '.button, .icon-button',
    '.case-button',
  ]) {
    const rule = reviewCss.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "s"));
    assert.ok(rule, `${selector} must have an explicit control rule`);
    assert.match(rule[0], /min-height\s*:\s*var\(--review-control-touch\)/i, `${selector} must retain the review touch-target token`);
  }
  assert.match(reviewCss, /--review-control-touch\s*:\s*44px/i);
});

test("loaded scenario choices keep a 44px clickable label target", () => {
  const reviewCss = readPublicFile("scenario-review.css");

  assert.match(reviewCss, /\.inline-check,\s*\.check-control\s*\{[^}]*min-height\s*:\s*var\(--review-control-touch\)/i);
  assert.match(reviewCss, /(?:\.inline-check|\.check-control)[^\{]*input[^\{]*\{[^}]*(?:width|min-width)\s*:\s*var\(--review-control-native\)[^}]*(?:height|min-height)\s*:\s*var\(--review-control-native\)/i);
  assert.match(reviewCss, /--review-control-touch\s*:\s*44px/i);
  assert.match(reviewCss, /--review-control-native\s*:\s*20px/i);
});

test("scenario research workspaces stay hidden until their data is loaded", () => {
  const reviewCss = readPublicFile("scenario-review.css");

  assert.match(reviewCss, /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/i);
});

test("mobile pre-survey profile fields use one readable column", () => {
  const indexCss = readPublicFile("index.css");
  const mobileRule = indexCss.match(/@media\s*\(max-width:\s*520px\)\s*\{[\s\S]*?\n\}/);

  assert.ok(mobileRule, "index must define its 375px field layout");
  assert.match(mobileRule[0], /\.row\s*\{[^}]*grid-template-columns\s*:\s*1fr/i);
});

test("seven-point scales protect the 375px layout without reducing touch targets", () => {
  const postSurvey = readPublicFile("post-survey.css");
  const postSurveyScript = readPublicFile("post-survey.js");

  assert.match(postSurveyScript, /data-scale-points="\$\{max\}"/);
  const narrowRule = postSurvey.match(/@media\s*\(max-width:\s*400px\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(narrowRule, "post-survey must define a <=400px layout contract");
  assert.match(narrowRule[0], /\.scale-wrapper\[data-scale-points="7"\][\s\S]*?min-width\s*:\s*0/i);
  assert.match(narrowRule[0], /\.scale-item[\s\S]*?min-width\s*:\s*0/i);
  assert.match(narrowRule[0], /\.scale-num[\s\S]*?(?:width|height)\s*:\s*var\(--post-scale-number-narrow\)/i);
  assert.match(narrowRule[0], /\.scale-label[\s\S]*?white-space\s*:\s*normal/i);
});

test("new chat content scrolls after controls change and after its enter animation", () => {
  const safer = readPublicFile("safer.js");
  const scrollHelper = namedFunctionSource(safer, "scrollChatToBottom");
  assert.equal((scrollHelper.match(/requestAnimationFrame/g) ?? []).length, 2, "chat scroll must wait for two paint frames");

  const appendBubble = namedFunctionSource(safer, "appendBubble");
  assert.match(appendBubble, /addEventListener\(\s*"animationend"[\s\S]*?scrollChatToBottom/s);

  for (const functionName of ["clearControls", "showAnswerInput", "showQuickReply", "showMissingRuleConfirmation", "showFinalRuleSelection"]) {
    const functionSource = namedFunctionSource(safer, functionName);
    assert.match(functionSource, /scrollChatToBottom\(\)/, `${functionName} must correct chat scroll after changing control visibility`);
  }

  assert.match(
    safer,
    /window\.addEventListener\(\s*"resize",\s*scrollChatToBottom\s*\)/,
    "viewport changes must keep the latest voice-enabled message above the composer",
  );
});

test("mobile Turn 4 composer fully contains its two-line Korean placeholder", () => {
  const foundationCss = readPublicFile(path.join("safer-styles", "foundation.css"));
  const saferCss = readPublicFile(path.join("safer-styles", "responsive.css"));

  assert.match(foundationCss, /--mobile-composer-height\s*:\s*(?:7[2-9]|[89]\d|\d{3,})px/i);
  assert.match(
    saferCss,
    /@media\s*\(max-width:\s*720px\)[\s\S]*?#chat-input\s*\{[^}]*min-height\s*:\s*var\(--mobile-composer-height\)/i,
    "the mobile composer must reserve at least two 16px text lines plus padding",
  );
});

test("Turn 4 shows a participant-safe scenario reminder above the shared composer", () => {
  const saferHtml = readPublicFile("safer.html");
  const view = readPublicFile(path.join("safer", "view.js"));
  const controlsCss = readPublicFile(path.join("safer-styles", "controls.css"));
  const reminderPosition = saferHtml.indexOf('id="scenario-recall-card"');
  const composerPosition = saferHtml.indexOf('id="chat-form"');

  assert.notEqual(reminderPosition, -1, "the scenario reminder must exist");
  assert.ok(reminderPosition < composerPosition, "the reminder must appear immediately above the composer");
  assert.match(namedFunctionSource(view, "showAnswerInput"), /renderScenarioRecall\(\)[\s\S]*?scenarioRecallCard\.hidden\s*=\s*false/);
  assert.match(namedFunctionSource(view, "clearControls"), /scenarioRecallCard\.hidden\s*=\s*true/);
  assert.match(namedFunctionSource(view, "renderScenarioRecall"), /actualCase\.summary/);
  assert.doesNotMatch(namedFunctionSource(view, "renderScenarioRecall"), /raw_text|sourceTextContent/);
  assert.match(controlsCss, /\.scenario-recall-card\s*\{[^}]*background\s*:\s*rgba\([^)]*,\s*0\.9\)/is);
});

test("voice controls use solid high-contrast keyboard focus rings", () => {
  const saferCss = [
    "foundation.css",
    "conversation.css",
    "controls.css",
  ].map((fileName) => readPublicFile(path.join("safer-styles", fileName))).join("\n");

  assert.match(
    saferCss,
    /\.voice-input-button:focus-visible,\s*#send-button:focus-visible\s*\{[^}]*outline\s*:\s*3px\s+solid\s+var\(--focus-ring\)[^}]*outline-offset\s*:\s*2px/is,
  );
  assert.match(
    saferCss,
    /--white\s*:\s*#fff/i,
  );
  assert.match(
    saferCss,
    /\.message-tts-button:focus-visible\s*\{[^}]*outline\s*:\s*3px\s+solid\s+var\(--white\)[^}]*outline-offset\s*:\s*2px/is,
  );
});

test("work-awareness messages select 을 or 를 from the final Hangul consonant", () => {
  const safer = readPublicFile("safer.js");
  const helperSource = safer.match(/function hasHangulFinalConsonant\([\s\S]*?\n\}\n\nfunction withObjectParticle\([\s\S]*?\n\}/);
  assert.ok(helperSource, "safer.js must have a deterministic object-particle helper");

  const helpers = vm.runInNewContext(`${helperSource[0]}; ({ hasHangulFinalConsonant, withObjectParticle });`);
  assert.equal(helpers.hasHangulFinalConsonant("작업"), true);
  assert.equal(helpers.hasHangulFinalConsonant("철거"), false);
  assert.equal(helpers.withObjectParticle("작업"), "작업을");
  assert.equal(helpers.withObjectParticle("철거"), "철거를");

  const messageBuilder = safer.match(/function getWorkAwarenessMessage\([\s\S]*?\n\}/);
  assert.ok(messageBuilder, "work-awareness message builder must exist");
  assert.doesNotMatch(messageBuilder[0], /\$\{work\}을/);
  assert.match(messageBuilder[0], /withObjectParticle\(work\)/);
});
