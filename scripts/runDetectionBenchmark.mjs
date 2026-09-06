// Scores glasses and headwear detection against the human-verified labels in
// public/test-fixtures/ground-truth.json.
//
// Usage (a dev server must already be running):
//   npm run dev:client
//   node scripts/runDetectionBenchmark.mjs
//
// Options:
//   --url <validation lab url>   override the page under test
//   --json <path>                also write the raw per-case analysis to a file
//
// False positives block checkout for a compliant photo, so precision matters as
// much as recall here. Per-skin-tone recall is reported separately because an
// aggregate number hides the failure mode that prompted this benchmark.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const groundTruthPath = resolve(rootDir, 'public', 'test-fixtures', 'ground-truth.json');

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const pageUrl = getArg(
  '--url',
  'http://127.0.0.1:5173/validation-lab.html?manifest=/test-fixtures/pipeline-batch.json',
);
const jsonOut = getArg('--json', '');

function normalize(sourcePath) {
  return String(sourcePath || '').replace('/test-fixtures/', '');
}

function scoreBinary(rows, truthKey, predKey) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;

  for (const row of rows) {
    const truth = Boolean(row.truth[truthKey]);
    const predicted = Boolean(row.predicted[predKey]);

    if (truth && predicted) truePositive += 1;
    else if (!truth && predicted) falsePositive += 1;
    else if (truth && !predicted) falseNegative += 1;
    else trueNegative += 1;
  }

  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null;
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null;
  const falsePositiveRate = falsePositive + trueNegative ? falsePositive / (falsePositive + trueNegative) : null;

  return { truePositive, falsePositive, falseNegative, trueNegative, recall, precision, falsePositiveRate };
}

function formatRate(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function printScore(title, score) {
  console.log(`\n${title}`);
  console.log(`  recall     ${formatRate(score.recall)}  (${score.truePositive}/${score.truePositive + score.falseNegative} found)`);
  console.log(`  precision  ${formatRate(score.precision)}`);
  console.log(`  FPR        ${formatRate(score.falsePositiveRate)}  (${score.falsePositive} compliant photos wrongly blocked)`);
}

const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8'));
const truthByFile = new Map(groundTruth.cases.map((entry) => [entry.file, entry]));

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__validationLabComplete === true, null, { timeout: 900000 });

  const summary = await page.evaluate(() => window.__validationLabSummary);
  const labError = await page.evaluate(() => window.__validationLabError);

  if (!Array.isArray(summary)) {
    throw new Error('Validation lab did not produce a summary array.');
  }

  const rows = [];
  const unlabelled = [];

  for (const entry of summary) {
    const file = normalize(entry.sourcePath);
    const truth = truthByFile.get(file);

    if (!truth) {
      unlabelled.push(file);
      continue;
    }

    rows.push({
      file,
      truth,
      predicted: {
        glasses: Boolean(entry.eyewearDetected),
        hat: Boolean(entry.hatDetected),
        headCovering: Boolean(entry.hijabDetected),
      },
      analysis: entry,
      faceFound: !(entry.headwearType === 'unknown' && !Number(entry.eyewearScore || 0)),
    });
  }

  if (jsonOut) {
    writeFileSync(resolve(rootDir, jsonOut), JSON.stringify({ labError, rows }, null, 2));
  }

  const glasses = scoreBinary(rows, 'glasses', 'glasses');
  const hat = scoreBinary(rows, 'hat', 'hat');

  console.log(`Detection benchmark — ${rows.length} labelled cases`);
  if (labError) console.log(`Validation lab reported: ${labError}`);
  if (unlabelled.length) {
    console.log(`\n${unlabelled.length} case(s) ran but have no ground-truth label and were excluded:`);
    unlabelled.forEach((file) => console.log(`  - ${file}`));
  }

  printScore('GLASSES', glasses);
  printScore('HAT', hat);

  const tones = [...new Set(rows.map((row) => row.truth.skinTone))].sort();
  console.log('\nGlasses recall by skin tone (aggregate numbers hide per-group regressions)');
  for (const tone of tones) {
    const subset = rows.filter((row) => row.truth.skinTone === tone);
    const score = scoreBinary(subset, 'glasses', 'glasses');
    const positives = score.truePositive + score.falseNegative;
    console.log(
      `  ${String(tone).padEnd(7)} recall ${formatRate(score.recall).padStart(6)}` +
        `  (${score.truePositive}/${positives} found, ${subset.length} images, FPR ${formatRate(score.falsePositiveRate)})`,
    );
  }

  const missed = rows.filter((row) => row.truth.glasses && !row.predicted.glasses);
  if (missed.length) {
    console.log('\nMissed glasses');
    for (const row of missed) {
      const a = row.analysis;
      console.log(`  ${row.file}`);
      console.log(
        `    score=${Number(a.eyewearScore || 0).toFixed(2)}` +
          ` bridgeD=${Number(a.bridgeDarkRatio || 0).toFixed(3)}` +
          ` bridgeE=${Number(a.bridgeEdgeDensity || 0).toFixed(3)}` +
          ` tmplD=${Number(a.templeDarkRatio || 0).toFixed(3)}` +
          ` bandE=${Number(a.eyeBandEdgeDensity || 0).toFixed(3)}` +
          ` glare=${Number(a.glareRatio || 0).toFixed(3)}`,
      );
      console.log(`    ${row.truth.notes}`);
    }
  }

  const wronglyBlocked = rows.filter((row) => !row.truth.glasses && row.predicted.glasses);
  if (wronglyBlocked.length) {
    console.log('\nFalse positives (compliant photos wrongly blocked)');
    wronglyBlocked.forEach((row) => console.log(`  ${row.file}`));
  }

  const noFace = rows.filter((row) => !row.faceFound);
  if (noFace.length) {
    console.log('\nNo face detected — every check silently reports a pass on these');
    noFace.forEach((row) => console.log(`  ${row.file}`));
  }

  const classifierReady = summary.some((entry) => entry.eyewearClassifierReady);
  console.log(`\nLearned eyewear classifier active: ${classifierReady ? 'yes' : 'NO (heuristic only)'}`);
} finally {
  await browser.close();
}
