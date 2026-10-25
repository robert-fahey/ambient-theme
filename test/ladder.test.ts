import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Controller, Step, bandFor, calibrate, normalizeLadder, rawBand } from '../src/ladder';

const ladder: Step[] = normalizeLadder([
  { maxLux: null, theme: 'HC Light', dark: false },
  { maxLux: 80, theme: 'Sol Dark', dark: true },
  { maxLux: 15, theme: 'Dark', dark: true },
  { maxLux: 2000, theme: 'Light', dark: false },
  { maxLux: 400, theme: 'Sol Light', dark: false },
]);

test('normalizeLadder sorts by maxLux with unbounded last', () => {
  assert.deepEqual(ladder.map((s) => s.theme), ['Dark', 'Sol Dark', 'Sol Light', 'Light', 'HC Light']);
});

test('rawBand picks the containing step', () => {
  assert.equal(rawBand(0, ladder), 0);
  assert.equal(rawBand(15, ladder), 1);
  assert.equal(rawBand(399, ladder), 2);
  assert.equal(rawBand(100000, ladder), 4);
});

test('bandFor holds the current band inside the hysteresis margin', () => {
  // Band 2 spans [80, 400). 15% margin -> leave below 68 or at/above 460.
  assert.equal(bandFor(70, ladder, 2, 0.15), 2);
  assert.equal(bandFor(67, ladder, 2, 0.15), 1);
  assert.equal(bandFor(459, ladder, 2, 0.15), 2);
  assert.equal(bandFor(460, ladder, 2, 0.15), 3);
  assert.equal(bandFor(5, ladder, 2, 0.15), 0);
});

test('controller applies first sample immediately', () => {
  const c = new Controller(ladder, { dwellMs: 20000, hysteresis: 0.15 });
  assert.equal(c.feed(500, 0), 3);
});

test('controller waits for dwell before switching', () => {
  const c = new Controller(ladder, { dwellMs: 20000, hysteresis: 0.15, alpha: 1 });
  c.feed(500, 0);
  assert.equal(c.feed(5, 1000), undefined);
  assert.equal(c.feed(5, 15000), undefined);
  assert.equal(c.feed(5, 21000), 0);
  assert.equal(c.currentBand, 0);
});

test('a brief shadow does not cause a switch', () => {
  const c = new Controller(ladder, { dwellMs: 20000, hysteresis: 0.15, alpha: 1 });
  c.feed(500, 0);
  c.feed(2, 1000);
  c.feed(2, 2000);
  assert.equal(c.feed(500, 3000), undefined);
  assert.equal(c.feed(500, 30000), undefined);
  assert.equal(c.currentBand, 3);
});

test('smoothing damps single spikes', () => {
  const c = new Controller(ladder, { dwellMs: 0, hysteresis: 0.15 });
  c.feed(200, 0);
  c.feed(5000, 1000);
  assert.ok(c.smoothedLux! < 1000);
});

test('calibrate widens a step upward and keeps order', () => {
  const out = calibrate(ladder, 1, 500);
  assert.equal(rawBand(500, out), 1);
  for (let i = 1; i < out.length - 1; i++) assert.ok(out[i].maxLux! > out[i - 1].maxLux!);
});

test('calibrate widens a step downward and keeps order', () => {
  const out = calibrate(ladder, 3, 10);
  assert.equal(rawBand(10, out), 3);
  for (let i = 1; i < out.length - 1; i++) assert.ok(out[i].maxLux! > out[i - 1].maxLux!);
});
