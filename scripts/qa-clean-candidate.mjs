import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Explicit committed snapshot only. Never install into or clean the working checkout.
const candidate = process.argv[2];
assert.match(candidate ?? '', /^[a-f0-9]{40}$/, 'Supply an exact candidate commit SHA');
const source = process.cwd();
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
assert.ok(existsSync(npmCli), 'Expected npm beside the selected Node installation');
assert.equal(process.versions.node.split('.')[0], '24', 'Use the calibrated Node 24 runtime');
const output = path.join(source, 'output');
mkdirSync(output, { recursive: true });
const resume = process.argv[3];
if (resume) assert.match(resume, /^clean-candidate-[a-zA-Z0-9]+$/, 'Resume only a named local evidence directory');
const evidence = resume ? path.join(output, resume) : mkdtempSync(path.join(output, 'clean-candidate-'));
const snapshot = path.join(evidence, 'snapshot');
if (!resume) mkdirSync(snapshot);
const report = resume ? JSON.parse(readFileSync(path.join(evidence, 'report.json'), 'utf8')) :
  { candidate, node: process.versions.node, platform: process.platform, arch: process.arch,
  snapshot, evidence, testConcurrency: 2, stages: [], passed: false };
if (resume) {
  assert.equal(report.candidate, candidate);
  assert.equal(report.node, process.versions.node);
  assert.equal(report.platform, process.platform);
  assert.equal(report.snapshot, snapshot);
  assert.equal(report.passed, false, 'Do not rerun a completed candidate');
  assert.equal(report.stages.at(-1)?.name, 'allocation-2', 'Resume only the remaining allocation/build steps');
  assert.ok(report.stages.some(stage => stage.name === 'unit' && stage.exitCode === 0 && !stage.timedOut));
  assert.ok(report.stages.some(stage => stage.name === 'allocation-1' && stage.exitCode === 0 && !stage.timedOut));
  const originalReport = path.join(evidence, 'report-before-resume.json');
  if (!existsSync(originalReport)) writeFileSync(originalReport, JSON.stringify(report, null, 2), { flag: 'wx' });
  delete report.error;
}
const persist = () => writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
const env = { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true', GEV_REQUIRE_ALLOCATION_GATE: '1' };
// Do not inherit options which could preload code or alter this clean candidate's tests.
delete env.NODE_OPTIONS;
delete env.NODE_PATH;

async function run(name, executable, args, cwd, timeoutMs) {
  const attempt = report.stages.filter(stage => stage.name === name).length + 1;
  const log = path.join(evidence, `${name}${attempt > 1 ? `-attempt-${attempt}` : ''}.log`), fd = openSync(log, 'wx');
  const stage = { name, command: [executable, ...args], log, timeoutMs };
  report.stages.push(stage); persist();
  const started = Date.now();
  console.log(JSON.stringify({ phase: name, evidence }));
  const child = spawn(executable, args, { cwd, env, stdio: ['ignore', fd, fd], windowsHide: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    // Scope termination to this owned child and descendants, never to process names.
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32') {
        const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'],
          { windowsHide: true, timeout: 10000, encoding: 'utf8' });
        stage.termination = { status: result.status, error: result.error?.message };
      } else child.kill('SIGKILL');
    }
  }, timeoutMs);
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    Object.assign(stage, { exitCode: code, timedOut, elapsedMs: Date.now() - started });
    console.log(JSON.stringify({ phase: name, exitCode: code, timedOut, elapsedMs: stage.elapsedMs, log }));
    assert.equal(timedOut, false, `${name} exceeded its time limit`);
    assert.equal(code, 0, `${name} failed; inspect ${log}`);
  } finally {
    clearTimeout(timer); closeSync(fd); persist();
  }
}

try {
  const hashLock = () => createHash('sha256').update(readFileSync(path.join(snapshot, 'package-lock.json'))).digest('hex');
  if (!resume) {
    const archive = path.join(evidence, 'candidate.tar');
    await run('archive', 'git', ['archive', '--format=tar', `--output=${archive}`, candidate], source, 60000);
    await run('extract', 'tar', ['-xf', archive, '-C', snapshot], source, 60000);
    assert.equal(existsSync(path.join(snapshot, 'node_modules')), false);
    assert.equal(existsSync(path.join(snapshot, '.env')), false);
    report.lockBefore = hashLock();
    await run('toolchain', process.execPath, [npmCli, '--version'], snapshot, 30000);
    await run('install', process.execPath, [npmCli, 'ci', '--no-audit', '--no-fund'], snapshot, 300000);
    report.lockAfter = hashLock();
    assert.equal(report.lockAfter, report.lockBefore, 'Clean install changed the lockfile');
    await run('ci-contract', process.execPath, ['--test', 'scripts/qa-astroeye-ci.test.mjs', 'src/unitTestRunner.test.mjs'], snapshot, 60000);
    const runner = await import(pathToFileURL(path.join(snapshot, 'scripts/run-unit-tests.mjs')).href);
    runner.assertNode24AllocationRuntime();
    const plan = runner.buildUnitTestPlan(runner.discoverUnitTestFiles(snapshot));
    report.testFileCounts = { ordinary: plan.parallel.length, allocations: plan.serializedAllocations.length };
    // Same complete discovered test set as npm test, but limit workers on the user's computer.
    await run('unit', process.execPath, ['--test', '--test-concurrency=2', ...plan.parallel], snapshot, 480000);
    for (const [index, file] of plan.serializedAllocations.entries()) {
      await run(`allocation-${index + 1}`, process.execPath, runner.allocationTestArgs(file), snapshot, 300000);
    }
  } else {
    assert.equal(hashLock(), report.lockBefore, 'Resume lockfile differs from the verified install');
    const runner = await import(pathToFileURL(path.join(snapshot, 'scripts/run-unit-tests.mjs')).href);
    runner.assertNode24AllocationRuntime();
    await run('allocation-2', process.execPath, runner.allocationTestArgs(runner.ALLOCATION_TEST_FILES[1]), snapshot, 300000);
  }
  await run('build', process.execPath, [npmCli, 'run', 'build'], snapshot, 300000);
  report.passed = true;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  persist();
  console.log(JSON.stringify({ passed: report.passed, error: report.error, evidence }));
}
