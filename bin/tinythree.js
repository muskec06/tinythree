#!/usr/bin/env node
// tinythree CLI
//   tinythree build  scene.t3 [-o scene.html] [--three <url>]   -> standalone HTML page
//   tinythree compile scene.t3 [-o scene.js]                    -> ES module: export default build(THREE)
//   tinythree check  scene.t3 [...more.t3]                      -> validate, exit 1 on error
//   tinythree tokens scene.t3 [threejs-version.js]              -> token count (o200k), and the saving vs. a Three.js file
import fs from 'node:fs';
import path from 'node:path';
import { compile, toHTML, parse, VERSION, DEFAULT_THREE_URL } from '../src/tinythree.js';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const opt = (name, def) => { const i = argv.indexOf(name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const out = opt('-o');
const threeUrl = opt('--three', DEFAULT_THREE_URL);
const files = argv;

function usage(code = 0) {
  console.log(`tinythree ${VERSION}
usage:
  tinythree build   <scene.t3> [-o out.html] [--three <url>]
  tinythree compile <scene.t3> [-o out.js]
  tinythree check   <scene.t3> [...]
  tinythree tokens  <scene.t3> [threejs-version.js]`);
  process.exit(code);
}
if (!cmd || cmd === '-h' || cmd === '--help') usage();
if (cmd === '-v' || cmd === '--version') { console.log(VERSION); process.exit(0); }
if (!files.length) usage(1);

try {
  if (cmd === 'check') {
    let bad = 0;
    for (const f of files) {
      try { parse(fs.readFileSync(f, 'utf8')); console.log(`ok    ${f}`); }
      catch (e) { bad++; console.error(`error ${f}: ${e.message}`); }
    }
    process.exit(bad ? 1 : 0);
  }
  if (cmd === 'tokens') {
    let getEncoding;
    try { ({ getEncoding } = await import('js-tiktoken')); }
    catch { console.error('error: run `npm install` first (needs js-tiktoken)'); process.exit(1); }
    const enc = getEncoding('o200k_base');
    const tok = (s) => enc.encode(s).length;
    const t3src = fs.readFileSync(files[0], 'utf8');
    parse(t3src);
    const t3 = tok(t3src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').trim());
    const lines = t3src.split('\n').filter((l) => l.trim() && !/^\s*\/\//.test(l)).length;
    console.log(`tinythree  ${files[0]}: ${t3} tokens, ${lines} lines`);
    if (files[1]) {
      const js = tok(fs.readFileSync(files[1], 'utf8').trim());
      const jsLines = fs.readFileSync(files[1], 'utf8').split('\n').filter((l) => l.trim()).length;
      console.log(`Three.js  ${files[1]}: ${js} tokens, ${jsLines} lines`);
      console.log(`saving    ${(js / t3).toFixed(1)}x fewer tokens (${js - t3} tokens saved, ${Math.round((1 - t3 / js) * 100)}% less)`);
    }
    console.log('tokenizer o200k_base; comment lines in the .t3 are not counted');
    process.exit(0);
  }
  const file = files[0];
  const src = fs.readFileSync(file, 'utf8');
  let result;
  if (cmd === 'build') result = toHTML(src, { threeUrl, title: path.basename(file, '.t3') });
  else if (cmd === 'compile') result = compile(src);
  else usage(1);
  if (out) { fs.writeFileSync(out, result); console.error(`wrote ${out}`); }
  else process.stdout.write(result);
} catch (e) {
  console.error(e.name === 'TinyThreeError' ? `error: ${e.message}` : e.stack);
  process.exit(1);
}
