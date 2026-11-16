// Token benchmark: tinythree source vs. hand-written idiomatic Three.js for the same scene.
// Usage: node bench/run.js [--md]   (needs devDependency js-tiktoken)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEncoding } from 'js-tiktoken';
import { compile } from '../src/tinythree.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const enc = getEncoding('o200k_base');
const tok = (s) => enc.encode(s).length;
const stripT3 = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').trim();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const boiler = tok(read('bench/threejs/_boilerplate.js'));
const prompt = tok(read('ai/SYSTEM_PROMPT.md'));
const rows = [];
for (const f of fs.readdirSync(path.join(root, 'bench/threejs')).filter((f) => !f.startsWith('_')).sort()) {
  const name = f.replace(/\.js$/, '');
  const t3 = stripT3(read(`examples/${name}.t3`));
  compile(t3); // make sure the example still compiles
  const js = tok(read(`bench/threejs/${f}`)), t = tok(t3);
  rows.push({ name, js, t3: t, ratio: js / t, ratioNoBoiler: (js - boiler) / t });
}
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const total = { name: 'total', js: sum('js'), t3: sum('t3') };
total.ratio = total.js / total.t3;
total.ratioNoBoiler = (total.js - boiler * rows.length) / total.t3;
const saved = (total.js - total.t3) / rows.length;

const md = [
  '| scene | Three.js tokens | tinythree tokens | fewer tokens | without boilerplate* |',
  '|---|---:|---:|---:|---:|',
  ...[...rows, total].map((r) => `| ${r.name === 'total' ? '**total**' : r.name} | ${r.js} | ${r.t3} | **${r.ratio.toFixed(1)}×** | ${r.ratioNoBoiler.toFixed(1)}× |`),
  '',
  `\\* minus ${boiler} tokens of renderer/controls/resize setup that every Three.js page needs and tinythree hides.`,
  '',
  `AI prompt that teaches the language (\`ai/SYSTEM_PROMPT.md\`): **${prompt} tokens**, sent once per conversation (and cacheable).`,
  `Average saving per scene: ${Math.round(saved)} tokens → the prompt pays for itself after ~${Math.ceil(prompt / saved)} scenes or edits.`,
  '',
  'Tokenizer: OpenAI o200k_base via js-tiktoken (Claude\'s tokenizer differs; ratios are similar because both are BPE).',
].join('\n');
console.log(md);
if (process.argv.includes('--md')) {
  fs.writeFileSync(path.join(root, 'bench/RESULTS.md'), '# Benchmark results\n\n' + md + '\n');
  fs.writeFileSync(path.join(root, 'bench/results.json'), JSON.stringify({ prompt, boiler, rows, total }, null, 2) + '\n');
}
