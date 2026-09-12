import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { treeGeometry, bounds, contains } from '../app/components/map-geometry.ts';
const collection = JSON.parse(await readFile(new URL('../public/map/suburbs.geojson', import.meta.url), 'utf8'));
test('13 unique official Melbourne boundaries with observed canopy values', () => {
  assert.equal(collection.features.length, 13);
  assert.equal(new Set(collection.features.map(f => f.properties.name)).size, 13);
  for (const f of collection.features) {
    const [[w,s],[e,n]] = bounds(f);
    assert.ok(w > 144 && e < 146 && s > -39 && n < -37);
    assert.ok(f.properties.canopy >= 0 && f.properties.canopy <= 100);
  }
});
for (const count of [0, 1, 50, 500]) test(`exactly ${count} 3D trees inside each boundary`, () => {
  for (const f of collection.features) {
    const data = treeGeometry(f, count, 2050, null);
    assert.equal(data.features.length, count * 10);
    for (let i = 0; i < data.features.length; i += 10) {
      const trunk = data.features[i];
      const ring = trunk.geometry.coordinates[0].slice(0, -1);
      const center = ring.reduce((p, v) => [p[0] + v[0] / ring.length, p[1] + v[1] / ring.length], [0,0]);
      assert.ok(contains(center, f));
      assert.equal(trunk.properties.base, 0);
      assert.ok(trunk.properties.height > 0);
      assert.ok(data.features[i + 9].properties.height > trunk.properties.height);
    }
  }
});
test('preview geometry is deterministic and grows in height', () => {
  const f = collection.features.find(f => f.properties.name === 'Carlton');
  const a = treeGeometry(f, 50, 2030, null);
  assert.deepEqual(a, treeGeometry(f, 50, 2030, null));
  assert.ok(treeGeometry(f, 50, 2050, null).features[9].properties.height > a.features[9].properties.height);
});
test('all planning scales and results modules remain available', async () => {
  const source = await readFile(new URL('../app/scenario/page.tsx', import.meta.url), 'utf8');
  for (const mode of ['suburb','clue','street']) assert.ok(source.includes(`<TabsTrigger value="${mode}">`));
  for (const tab of ['overview','canopy','heat','model','details','street-view','cost','evidence']) assert.ok(source.includes(`<TabsTrigger value="${tab}"`));
  assert.equal((source.match(/<PlannerValidationPanel/g) ?? []).length, 1);
  assert.equal((source.match(/<PlannerDecisionPanel/g) ?? []).length, 1);
});
