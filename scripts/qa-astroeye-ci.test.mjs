import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import yaml from 'js-yaml';
import { isCalibratedAllocationRuntime } from './run-unit-tests.mjs';

// Uses the repository's locked js-yaml development dependency tree. Run after npm ci.
const workflow = yaml.load(readFileSync(new URL('../.github/workflows/astroeye-ci.yml', import.meta.url), 'utf8'));
const job = workflow.jobs.verify;

test('CI uses unprivileged events, read-only permissions and immutable action pins', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(Object.keys(workflow.jobs), ['verify']);
  const actions = job.steps.filter(step => step.uses);
  assert.equal(actions.length, 2);
  assert.match(actions[0].uses, /^actions\/checkout@[a-f0-9]{40}$/);
  assert.match(actions[1].uses, /^actions\/setup-node@[a-f0-9]{40}$/);
  assert.equal(actions[0].with['persist-credentials'], false);
  assert.equal(actions[1].with['package-manager-cache'], false);
  assert.equal(JSON.stringify(workflow).includes('secrets.'), false);
});

test('CI fixes a calibrated Node 24 runtime on both target operating systems', () => {
  assert.deepEqual(job.strategy.matrix.os, ['ubuntu-24.04', 'windows-2025']);
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  const version = job.steps.find(step => step.uses?.startsWith('actions/setup-node@')).with['node-version'];
  assert.equal(version, '24.21.0');
  assert.equal(isCalibratedAllocationRuntime(version), true);
  assert.equal(job.env.GEV_REQUIRE_ALLOCATION_GATE, '1');
  assert.equal(job.env.PUPPETEER_SKIP_DOWNLOAD, 'true');
});

test('CI installs the lockfile before full tests and build, without tolerated failures', () => {
  const commands = job.steps.filter(step => step.run).map(step => step.run.trim());
  assert.deepEqual(commands, [
    'git rev-parse HEAD\nnode --version\nnpm --version',
    'npm ci --no-audit --no-fund',
    'node --test scripts/qa-astroeye-ci.test.mjs src/unitTestRunner.test.mjs',
    'npm test', 'npm run build',
  ]);
  for (const step of job.steps) {
    assert.equal(step['continue-on-error'], undefined);
    assert.equal(step.if, undefined);
  }
});

test('CI caps job/step time and concurrency instead of leaving runaway jobs', () => {
  assert.equal(job['timeout-minutes'], 20);
  assert.equal(job.strategy['max-parallel'], 1);
  assert.equal(job.strategy['fail-fast'], false);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  for (const command of ['npm ci --no-audit --no-fund', 'npm test', 'npm run build']) {
    const step = job.steps.find(step => step.run === command);
    assert.ok(step['timeout-minutes'] > 0 && step['timeout-minutes'] <= 8);
  }
});
