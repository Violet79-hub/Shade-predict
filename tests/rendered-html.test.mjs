import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
test('exports production pages with complete planning controls', async () => {
  for (const route of ['index','scenario','priority']) {
    const html = await readFile(new URL(`../out/${route}.html`, import.meta.url), 'utf8');
    assert.match(html, /Shade 2050/);
    assert.match(html, /<main|app-shell/);
  }
  const planner = await readFile(new URL('../out/scenario.html', import.meta.url), 'utf8');
  for (const label of ['Suburb','CLUE Area','Street corridor','3D trees','Review impact']) assert.ok(planner.includes(label));
  const map = planner.match(/<section class="geo-workspace"[\s\S]*?<\/section>/)?.[0];
  assert.ok(map, 'Geographic map container is exported');
  assert.doesNotMatch(map, /preserveAspectRatio="none"/);
});
