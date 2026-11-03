import test from 'node:test';
import assert from 'node:assert/strict';
import {photoCrop} from './photoCrop.mjs';

test('portrait and landscape images start with a centered square crop', () => {
  assert.deepEqual(photoCrop(800, 1200), {sx: 0, sy: 200, size: 800});
  assert.deepEqual(photoCrop(1200, 800), {sx: 200, sy: 0, size: 800});
});

test('zoom and dragging keep the exported region inside the source image', () => {
  for (const [width, height] of [[800, 1200], [1200, 800], [512, 512]]) {
    for (const zoom of [1, 2, 4, 10]) {
      for (const x of [-1, 0, .5, 1, 2]) {
        for (const y of [-1, 0, .5, 1, 2]) {
          const crop = photoCrop(width, height, zoom, x, y);
          assert.ok(crop.sx >= 0 && crop.sy >= 0);
          assert.ok(crop.sx + crop.size <= width && crop.sy + crop.size <= height);
        }
      }
    }
  }
  assert.deepEqual(photoCrop(800, 1200, 2, 1, 0), {sx: 400, sy: 0, size: 400});
});

test('invalid dimensions cannot produce a blank or invalid crop', () => {
  for (const args of [[0, 100], [100, -1], [NaN, 100], [100, 100, Infinity]]) assert.throws(() => photoCrop(...args));
});
