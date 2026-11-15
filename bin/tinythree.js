#!/usr/bin/env node
// tinythree CLI
//   tinythree build  scene.t3 [-o scene.html] [--three <url>]   -> standalone HTML page
//   tinythree compile scene.t3 [-o scene.js]                    -> ES module: export default build(THREE)
//   tinythree check  scene.t3 [...more.t3]                      -> validate, exit 1 on error
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
  tinythree check   <scene.t3> [...]`);
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
