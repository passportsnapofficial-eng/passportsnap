// Release gate for hat / glasses / head-covering / face-mask handling.
//
// Runs the real pipeline over the labelled fixtures and scores the verdict the
// customer would see - blocked, asked to confirm, or cleared - against
// public/test-fixtures/ground-truth.json. It exists because three commits in a
// row once turned these detectors into advisory notes and nothing noticed.
//
// Usage (dev server and, ideally, the attribute service must be running):
//   npm run dev
//   npm run gate:attributes
//
// Options:
//   --url <validation lab url>     page under test
//   --max-false-block <ratio>      fail if any attribute falsely blocks more than this share of compliant photos (default 0.05)
//   --json <path>                  write per-case results
//
// Exit code is non-zero on any SILENT MISS (a labelled positive the app
// cleared without asking) or when false blocks exceed the limit.

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
const maxFalseBlock = Number(getArg('--max-false-block', '0.05'));
const jsonPath = getArg('--json', '');

// ground-truth field -> the compliance check that must react to it
const ATTRIBUTES = [
  { field: 'glasses', check: 'eyewearFree', label: 'GLASSES', blocks: true },
  { field: 'hat', check: 'hatFree', label: 'HAT', blocks: true },
  { field: 'faceMask', check: 'maskFree', label: 'FACE MASK', blocks: true },
  // Religious head coverings are allowed: the only failure here is blocking one.
  { field: 'headCovering', check: 'hijabDetection', label: 'HEAD COVERING (allowed)', blocks: false },
];

function verdictFor(summary, check) {
  const status = summary.checkStatuses?.[check];
  if (status === 'failed') return 'blocked';
  if ((summary.pendingConfirmations || []).includes(check)) return 'asked';
  if (status === 'passed') return 'cleared';
  return 'note';
}

function pct(numerator, denominator) {
  return denominator ? `${((100 * numerator) / denominator).toFixed(1)}%` : 'n/a';
}

const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8'));
const labelled = new Map(groundTruth.cases.map((item) => [item.file.replace(/\\/g, '/'), item]));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage();
await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction(() => window.__validationLabComplete || window.__validationLabError, null, { timeout: 900000 });
const summaries = await page.evaluate(() => window.__validationLabSummary || []);
await browser.close();

const rows = [];
for (const summary of summaries) {
  if (summary.error) continue;
  const key = String(summary.sourcePath || '').replace(/^\/test-fixtures\//, '');
  const truth = labelled.get(key);
  if (!truth) continue;
  rows.push({ file: key, truth, summary });
}

const serviceUp = rows.some((row) => row.summary.attributeServiceAvailable);
console.log(`Attribute gate - ${rows.length} labelled cases scored`);
console.log(`Attribute service reachable during run: ${serviceUp ? 'YES' : 'NO (every verdict fell back to confirmation)'}\n`);

let failures = 0;
const report = {};
for (const { field, check, label, blocks } of ATTRIBUTES) {
  const hasLabels = rows.some((row) => field in row.truth);
  const positives = rows.filter((row) => row.truth[field] === true);
  const negatives = rows.filter((row) => row.truth[field] !== true);
  const count = (list, verdict) => list.filter((row) => verdictFor(row.summary, check) === verdict).length;

  const caught = count(positives, 'blocked');
  const asked = count(positives, 'asked');
  const silentMiss = count(positives, 'cleared');
  const falseBlock = count(negatives, 'blocked');
  const negAsked = count(negatives, 'asked');
  const cleared = count(negatives, 'cleared');

  console.log(`${label}${hasLabels ? '' : '   (no labels in ground truth - negatives only)'}`);
  if (blocks) {
    console.log(`  positives ${String(positives.length).padStart(3)}   blocked ${pct(caught, positives.length)}   asked ${pct(asked, positives.length)}   SILENT MISS ${pct(silentMiss, positives.length)}`);
  } else {
    const wronglyBlocked = count(positives, 'blocked');
    console.log(`  positives ${String(positives.length).padStart(3)}   wrongly blocked ${pct(wronglyBlocked, positives.length)} (must be 0 - these are allowed)`);
    if (wronglyBlocked) failures += 1;
  }
  console.log(`  negatives ${String(negatives.length).padStart(3)}   cleared ${pct(cleared, negatives.length)}   asked ${pct(negAsked, negatives.length)}   FALSE BLOCK ${pct(falseBlock, negatives.length)}`);

  if (blocks && silentMiss) {
    failures += 1;
    for (const row of positives.filter((r) => verdictFor(r.summary, check) === 'cleared')) {
      console.log(`    SILENT MISS: ${row.file}`);
    }
  }
  if (negatives.length && falseBlock / negatives.length > maxFalseBlock) {
    failures += 1;
    for (const row of negatives.filter((r) => verdictFor(r.summary, check) === 'blocked')) {
      console.log(`    FALSE BLOCK: ${row.file}`);
    }
  }
  console.log();
  report[field] = { positives: positives.length, negatives: negatives.length, caught, asked, silentMiss, falseBlock, negativesAsked: negAsked };
}

if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify({ serviceUp, report, cases: rows.map((row) => ({ file: row.file, truth: row.truth, verdicts: Object.fromEntries(ATTRIBUTES.map((a) => [a.field, verdictFor(row.summary, a.check)])), attributeStates: row.summary.attributeStates })) }, null, 2));
  console.log(`wrote ${jsonPath}`);
}

if (failures) {
  console.log(`GATE FAILED (${failures} attribute${failures === 1 ? '' : 's'})`);
  process.exit(1);
}
console.log('GATE PASSED: no silent misses, false blocks within limit.');
