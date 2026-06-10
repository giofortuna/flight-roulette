import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampTileCount } from './renderer.js';

// Tile geometry: box-sizing is border-box, so a tile's offsetWidth equals its
// CSS width (desktop lg = 23px, phone lg = 16px), plus the 2px .flap-row gap.

test('clampTileCount — desktop shell width resolves to the full 31 airline tiles', () => {
  // 860px shell − 40 padding − 36 card padding = 784px row
  assert.equal(clampTileCount(784, 23, 31), 31);
});

test('clampTileCount — 390px phone fits 18 airline tiles on one line', () => {
  // 390 − 24 shell − 28 card = 338px row, 16px phone tiles
  assert.equal(clampTileCount(338, 16, 31), 18);
});

test('clampTileCount — landscape phone fits 26 airline tiles', () => {
  // 740 − 40 shell − 36 card = 664px row, 23px desktop tiles
  assert.equal(clampTileCount(664, 23, 31), 26);
});

test('clampTileCount — never exceeds maxTiles even with room to spare', () => {
  assert.equal(clampTileCount(784, 23, 12), 12);
});

test('clampTileCount — exact fit boundary has no off-by-one', () => {
  // 10 tiles of 23px + 9 gaps of 2px = 248px
  assert.equal(clampTileCount(248, 23, 31), 10);
  assert.equal(clampTileCount(247, 23, 31), 9);
});

test('clampTileCount — floors at the minimum tile count on tiny widths', () => {
  assert.equal(clampTileCount(50, 23, 31), 6);
});

test('clampTileCount — zero available width falls back to maxTiles', () => {
  assert.equal(clampTileCount(0, 23, 31), 31);
});

test('clampTileCount — zero tile width falls back to maxTiles', () => {
  assert.equal(clampTileCount(784, 0, 31), 31);
});
