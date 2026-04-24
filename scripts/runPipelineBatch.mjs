import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const validationScript = resolve(rootDir, 'scripts', 'runValidationLab.mjs');
const validationUrl =
  process.argv[2] || 'http://127.0.0.1:5173/validation-lab.html?manifest=/test-fixtures/pipeline-batch.json';

function runValidation() {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [validationScript, validationUrl], {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (!stdout.trim()) {
        rejectRun(new Error(stderr.trim() || `Validation runner exited with code ${code}.`));
        return;
      }

      try {
        const payload = JSON.parse(stdout);
        resolveRun({ code, payload, stderr });
      } catch (error) {
        rejectRun(new Error(`Could not parse validation output.\n${stdout}\n${stderr}`));
      }
    });
  });
}

function summarizeReasons(items = []) {
  const counts = new Map();

  items.forEach((item) => {
    (item.rejectionReasons || []).forEach((reason) => {
      const key = String(reason || '').trim();
      if (!key) {
        return;
      }

      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({ reason, count }));
}

function summarizeBatch(summary = []) {
  const completed = summary.filter((entry) => !entry.error);
  const runtimeErrors = summary.filter((entry) => entry.error);
  const passed = completed.filter((entry) => entry.status === 'passed');
  const needsRetouch = completed.filter((entry) => entry.status === 'needs_retouch');
  const needsRetake = completed.filter((entry) => entry.status === 'needs_retake');
  const total = summary.length || 1;
  const completedTotal = completed.length || 1;

  return {
    totalCases: summary.length,
    runtimeErrorCount: runtimeErrors.length,
    pipelineSuccessRate: Number((completed.length / total).toFixed(3)),
    readyRate: Number((passed.length / completedTotal).toFixed(3)),
    passedCount: passed.length,
    needsRetouchCount: needsRetouch.length,
    needsRetakeCount: needsRetake.length,
    topFailureReasons: summarizeReasons([...needsRetouch, ...needsRetake]).slice(0, 10),
  };
}

async function main() {
  const { code, payload } = await runValidation();
  const summary = Array.isArray(payload.summary) ? payload.summary : [];
  const batch = summarizeBatch(summary);

  console.log(JSON.stringify({
    validationUrl,
    runnerExitCode: code,
    complete: payload.complete,
    errorMessage: payload.errorMessage,
    stage: payload.stage,
    batch,
    cases: summary,
  }, null, 2));

  if (payload.errorMessage) {
    process.exitCode = 1;
  }
}

await main();
