import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Reuse a complete local snapshot across UI-only builds. Explicit refresh:data
// remains available and fresh checkouts always run the official pipeline.
const snapshot = new URL('../app/generated-official-data.runtime.ts', import.meta.url);
let ready = false;
try {
  const source = await readFile(snapshot, 'utf8');
  const outputTime = (await stat(snapshot)).mtimeMs;
  const inputs = ['refresh-official-urban-data.mjs', 'refresh-official-data-entry.mjs', 'enrich-planning-data.mjs', 'run-official-refresh.mjs', 'run-planning-enrichment.mjs'];
  const newestInput = Math.max(...await Promise.all(inputs.map(async file => (await stat(new URL(file, import.meta.url))).mtimeMs)));
  ready = outputTime >= newestInput && source.includes('export const planningEnrichmentProvenance') && source.includes('export const modelValidation') && source.includes('export const planningGridByArea');
} catch { /* A missing or incomplete snapshot must be rebuilt. */ }
if (ready) console.log('Reusing complete official-data snapshot. Run npm run refresh:data to update observations.');
else {
  const result = spawnSync('npm', ['run', 'refresh:data'], { stdio: 'inherit', cwd: new URL('..', import.meta.url) });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
