import assert from 'node:assert/strict';
import test from 'node:test';
import { compareAngleReferences, readAngleReferences } from '../../../../scripts/astroeye-angle-references.mjs';

test('published date/location angles agree in both hemispheres and all supplied cusps pass', () => {
  const pack = readAngleReferences();
  const before = JSON.stringify(pack);
  const result = compareAngleReferences(pack);
  assert.equal(result.length, 2);
  assert.ok(pack.cases.some(({ latitude }) => latitude < 0));
  assert.ok(pack.cases.some(({ latitude }) => latitude > 0));
  assert.ok(pack.cases[0].cusps.equal.some((value, i, values) => i > 0 && value < values[i - 1]), 'published cusps cross zero');
  assert.ok(result.every(({ passed }) => passed), JSON.stringify(result));
  assert.equal(result[0].maximumCuspErrorArcseconds['whole-sign'], 0);
  assert.equal(result[1].maximumCuspErrorArcseconds, null, 'missing published cusps must not be generated from AstroEye');
  assert.equal(JSON.stringify(pack), before);
});

test('wrong UTC hour and reversed geographic longitude fail date-based screening', () => {
  for (const mutate of [
    (row) => { row.utcInstant = '2019-07-20T18:10:00.000Z'; },
    (row) => { row.longitude *= -1; },
  ]) {
    const pack = readAngleReferences();
    mutate(pack.cases[0]);
    assert.equal(compareAngleReferences(pack)[0].passed, false);
  }
});

test('wrong antipode and shifted cusp are detected without broadening tolerances', () => {
  for (const mutate of [
    (row) => { row.ascendant = (row.ascendant + 180) % 360; },
    (row) => { row.cusps.equal[7] += 1; },
    (row) => { row.cusps['whole-sign'][7] += 30; },
  ]) {
    const pack = readAngleReferences();
    mutate(pack.cases[0]);
    assert.equal(compareAngleReferences(pack)[0].passed, false);
  }
});

test('malformed numeric references and provenance fail closed', () => {
  for (const mutate of [
    (pack) => { pack.source.commit = 'latest'; },
    (pack) => { pack.conventions.dateComparisonToleranceArcseconds = 3600; },
    (pack) => { pack.cases[0].ascendant = null; },
    (pack) => { pack.cases[0].referenceLocalSiderealDegrees = NaN; },
    (pack) => { pack.cases[0].utcInstant = '2019-07-20T17:10:00'; },
    (pack) => { pack.cases[0].cusps.equal.pop(); },
    (pack) => { pack.cases[0].cusps['whole-sign'][0] = '150'; },
    (pack) => { pack.cases[1].id = pack.cases[0].id; },
  ]) {
    const pack = readAngleReferences();
    mutate(pack);
    assert.throws(() => compareAngleReferences(pack), /reference/);
  }
});
