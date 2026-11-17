// tinythree — a tiny, token-efficient 3D scene language that compiles to Three.js.
// Zero dependencies. Runs in the browser and in Node (ESM).
// https://github.com/muskec06/tinythree  ·  MIT License

export const VERSION = '0.3.0';
export const THREE_VERSION = '0.187.0';
export const DEFAULT_THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`;

/* ------------------------------------------------------------------ errors */

export class TinyThreeError extends Error {
  constructor(message, line, hint) {
    super(`line ${line}: ${message}${hint ? ` (${hint})` : ''}`);
    this.name = 'TinyThreeError';
    this.line = line;
    this.hint = hint || null;
  }
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggest(word, list) {
  let best = null, score = 3;
  for (const w of list) { const s = lev(word, w); if (s < score) { score = s; best = w; } }
  return best ? `did you mean "${best}"?` : `expected one of: ${list.join(', ')}`;
}

/* ------------------------------------------------------------------ lexing */

const NUM = /^-?(\d+\.?\d*|\.\d+)$/;
const IDENT = /^[A-Za-z_][\w-]*$/;
const PRIMS = ['box', 'sphere', 'cyl', 'cone', 'torus', 'plane', 'capsule', 'lathe', 'extrude', 'arrow', 'truss', 'text', 'model'];
const COMMANDS = ['scene', 'amb', 'hemi', 'sun', 'point', 'mat', 'group', 'use', 'anim', 'js', 'tick', 'renderer', ...PRIMS];
// Blender layer (https://github.com/muskec06/tinythree-blender): kept in the tree, skipped by the Three.js target
const BLENDER_COMMANDS = ['mod', 'con', 'set', 'key', 'render', 'cam', 'spot', 'area', 'sky', 'hdri', 'haze',
  'shade', 'terrain', 'curve', 'scatter', 'rigid'];
const FLAGS = ['floor', 'noshadow', 'hidden', 'play', 'top'];
const NODE_KEYS = ['rot', 'rx', 'ry', 'rz', 's', 'mirror', 'array', 'grid', 'radial', 'arc', 'lean', 'n', 't', 'seg', 'pts', 'd', 'bg', 'name'];

const isNum = (t) => NUM.test(t);
const isList = (t) => t.split(',').every(isNum);

function num(t, line, what = 'number') {
  if (!isNum(t)) throw new TinyThreeError(`expected ${what}, got "${t}"`, line);
  return parseFloat(t);
}
function list(t, line, n, what = 'numbers') {
  const parts = String(t).split(',');
  if (!parts.every(isNum)) throw new TinyThreeError(`expected ${what}, got "${t}"`, line);
  const v = parts.map(parseFloat);
  if (n && v.length !== n) {
    if (n === 3 && v.length === 1) return [v[0], v[0], v[0]];
    throw new TinyThreeError(`expected ${n} comma-separated numbers, got "${t}"`, line);
  }
  return v;
}
function color(t, line) {
  let h = t.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new TinyThreeError(`bad color "${t}"`, line, 'use #rgb or #rrggbb');
  return parseInt(h, 16);
}
function time(t, line) {
  const m = /^(-?\d*\.?\d+)(ms|s)?$/.exec(t);
  if (!m) throw new TinyThreeError(`bad time "${t}"`, line, 'use 2s, 500ms or 2');
  return parseFloat(m[1]) / (m[2] === 'ms' ? 1000 : 1);
}
function pairs(t, line) {
  // "0,0;1,0;1,2"  ->  [[0,0],[1,0],[1,2]]
  return t.split(';').filter(Boolean).map((p) => list(p, line, 2, 'x,y pairs'));
}

function lex(src) {
  const out = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const noComment = raw.replace(/(^|\s)\/\/.*$/, '');
    const indent = (noComment.match(/^[ \t]*/)[0] || '').replace(/\t/g, '  ').length;
    const text = noComment.trim();
    out.push({ line, indent, text, raw, tokens: text ? text.match(/"[^"]*"|\S+/g) : [] });
  });
  return out;
}

/* ------------------------------------------------------------------ part library */

// Real-world sizes, 1 unit = 1 m, origin at the base center, front facing +z. Used with `use lib:NAME`.
export const LIB = {
  tree: ['', 'cyl .15,1.6 @0,.8,0 #6b4b2a\nsphere 1.2 @0,2.6,0 #3f7a3a s=1,1.2,1'],
  pine: ['', 'cyl .12,.8 @0,.4,0 #6b4b2a\ncone 1,2.4 @0,1.9,0 #2f6b3a\ncone .75,1.8 @0,2.9,0 #2f6b3a'],
  bush: ['', 'sphere .6 @0,.45,0 #4a8a3f s=1.3,.8,1'],
  person: ['', 'cyl .09,.85 @.1,.43,0 #2b3a55 mirror=x\ncapsule .2,.45 @0,1.17,0 #c0392b\nsphere .13 @0,1.66,0 #e0b48c'],
  car: ['mat libglass #bcd9ef r=.1 m=.5 op=.8', 'box 4,.8,1.8 @0,.7,0 #2e86de\nbox 2.2,.7,1.6 @-.2,1.45,0 libglass\ncyl .35,.25 @1.3,.35,.85 rx=90 #222 mirror=xz'],
  bench: ['', 'box 1.6,.08,.45 @0,.45,0 #8b5a2b\nbox 1.6,.4,.06 @0,.75,-.2 #8b5a2b\nbox .06,.45,.4 @.7,.22,0 #333 mirror=x'],
  streetlamp: ['mat liblight #fff4c8 glow=2', 'cyl .05,.08,3.5 @0,1.75,0 #2d3436\nsphere .18 @0,3.6,0 liblight'],
  door: ['', 'box 1.1,2.2,.06 @0,1.1,0 #f2f2f2\nbox .9,2.05,.08 @0,1.03,0 #7b4a26\nsphere .04 @.33,1,.06 #d4af37'],
  window: ['mat libglass #bcd9ef r=.1 m=.5 op=.8', 'box 1.2,1.4,.08 @0,0,0 #f5f5f5\nbox 1,1.2,.1 libglass\nbox 1,.05,.11 #f5f5f5'],
  column: ['', 'box .7,.2,.7 @0,.1,0 #e8e1d3\ncyl .25,.28,3 @0,1.7,0 #efe9dc\nbox .7,.2,.7 @0,3.3,0 #e8e1d3'],
  fence: ['', 'box .08,1,.08 @0,.5,0 #8b5a2b array=6,.5,0,0\nbox 2.6,.06,.04 @1.25,.75,0 #8b5a2b\nbox 2.6,.06,.04 @1.25,.35,0 #8b5a2b'],
  stairs: ['', 'box 1.2,.17,.28 @0,.085,0 #bdb6aa array=10,0,.17,.28'],
  house: ['', 'box 6,3,5 @0,1.5,0 #efe6d8\nextrude pts=-3.4,0;3.4,0;0,2 d=5.4 @0,3,-2.7 #a5452c\nbox 1,2,.1 @0,1,2.5 #7b4a26\nbox 1,1,.1 @-1.8,1.7,2.5 #9ec9e8 mirror=x'],
};
export const TEXTURES = ['checker', 'grid', 'brick', 'tiles', 'wood', 'grass', 'noise'];

function ensureLib(ast, name, line) {
  if (ast.names.has('lib:' + name)) return;
  if (!LIB[name]) throw new TinyThreeError(`no library part "${name}"`, line, suggest(name, Object.keys(LIB)));
  const [mats, body] = LIB[name];
  const part = parse(`${mats}\ngroup name=lib:${name} hidden\n${body.split('\n').map((l) => '  ' + l).join('\n')}`);
  for (const [k, m] of Object.entries(part.mats)) if (!ast.mats[k]) ast.mats[k] = m;
  ast.nodes.unshift(part.nodes[0]);
  ast.names.add('lib:' + name);
}

/* ------------------------------------------------------------------ parsing */

export function parse(src) {
  const lines = lex(src);
  const ast = {
    scene: { bg: 0x101418, cam: [4, 3, 6], look: [0, 0, 0], fov: 50, ortho: 0, orbit: false, shadows: false,
      grid: false, axes: false, fog: null, dur: 0, size: [1280, 720], transparent: false },
    mats: {}, nodes: [], anims: [], js: [], tick: [], host: [], names: new Set(),
    py: [], blender: [], // Blender layer: kept in the tree for other targets, ignored by Three.js
  };
  const stack = [{ indent: -1, children: ast.nodes }];

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!L.tokens.length) continue;
    const [cmd, ...args] = L.tokens;
    const line = L.line;

    if (BLENDER_COMMANDS.includes(cmd)) {
      // Blender-only lines; Three.js skips them
      if (L.indent > 0) throw new TinyThreeError(`"${cmd}" cannot be indented`, line);
      ast.blender.push({ cmd, args, line });
      continue;
    }
    if (cmd === 'js' || cmd === 'tick' || cmd === 'renderer' || cmd === 'py') {
      const body = [];
      while (i + 1 < lines.length && (lines[i + 1].indent > L.indent || !lines[i + 1].text)) {
        i++;
        body.push(lines[i].raw.replace(/^\s{0,2}/, ''));
      }
      ({ js: ast.js, tick: ast.tick, renderer: ast.host, py: ast.py })[cmd].push(body.join('\n'));
      continue;
    }
    if (!COMMANDS.includes(cmd)) throw new TinyThreeError(`unknown command "${cmd}"`, line, suggest(cmd, COMMANDS));

    while (stack.length > 1 && L.indent <= stack[stack.length - 1].indent) stack.pop();
    if (L.indent > 0 && stack.length === 1 && !['group', 'use', 'amb', 'hemi', 'sun', 'point', ...PRIMS].includes(cmd))
      throw new TinyThreeError(`"${cmd}" cannot be indented`, line);

    switch (cmd) {
      case 'scene': parseScene(ast.scene, args, line); break;
      case 'amb': case 'hemi': case 'sun': case 'point':
        stack[stack.length - 1].children.push({ type: 'light', line, light: parseLight(cmd, args, line), flags: new Set() }); break;
      case 'mat': parseMat(ast, args, line); break;
      case 'anim': ast.anims.push(parseAnim(args, line)); break;
      default: {
        const node = parseNode(ast, cmd, args, line);
        stack[stack.length - 1].children.push(node);
        if (cmd === 'group') stack.push({ indent: L.indent, children: node.children });
      }
    }
  }

  // validate references
  const allNames = new Set([...ast.names, ...Object.keys(ast.mats), 'cam']);
  for (const a of ast.anims)
    if (!allNames.has(a.target))
      throw new TinyThreeError(`anim: unknown target "${a.target}"`, a.line, suggest(a.target, [...allNames]));
  return ast;
}

function kv(tok) {
  const i = tok.indexOf('=');
  return i > 0 ? [tok.slice(0, i), tok.slice(i + 1)] : null;
}

function parseScene(s, args, line) {
  for (const t of args) {
    const p = kv(t);
    if (!p) {
      if (['orbit', 'shadows', 'grid', 'axes'].includes(t)) s[t] = true;
      else throw new TinyThreeError(`unknown scene flag "${t}"`, line, suggest(t, ['orbit', 'shadows', 'grid', 'axes']));
      continue;
    }
    const [k, v] = p;
    switch (k) {
      case 'bg': if (v === 'none') { s.transparent = true; s.bg = null; } else s.bg = color(v, line); break;
      case 'cam': s.cam = list(v, line, 3); break;
      case 'look': s.look = list(v, line, 3); break;
      case 'fov': s.fov = num(v, line); break;
      case 'ortho': s.ortho = num(v, line); break;
      case 'dur': s.dur = time(v, line); break;
      case 'size': s.size = list(v, line, 2); break;
      case 'fog': { const [c, n, f] = v.split(','); s.fog = [color(c, line), num(n ?? '5', line), num(f ?? '40', line)]; break; }
      default: throw new TinyThreeError(`unknown scene option "${k}"`, line,
        suggest(k, ['bg', 'cam', 'look', 'fov', 'ortho', 'dur', 'size', 'fog']));
    }
  }
}

function parseLight(type, args, line) {
  const l = { type, line, color: 0xffffff, intensity: type === 'point' ? 2 : 1, pos: null, ground: 0x444444, dist: 0, area: 10 };
  const nums = [];
  let colors = 0;
  for (const t of args) {
    const p = kv(t);
    if (t.startsWith('@')) l.pos = list(t.slice(1), line, 3);
    else if (t.startsWith('#')) { if (type === 'hemi' && colors++ === 1) l.ground = color(t, line); else l.color = color(t, line); }
    else if (p && p[0] === 'area') l.area = num(p[1], line);
    else if (t.includes(',') && isList(t)) l.pos = list(t, line, 3);
    else if (isNum(t)) nums.push(parseFloat(t));
    else throw new TinyThreeError(`unexpected "${t}" in ${type}`, line);
  }
  if (nums[0] !== undefined) l.intensity = nums[0];
  if (nums[1] !== undefined) l.dist = nums[1];
  if (type === 'sun' && !l.pos) l.pos = [5, 10, 7];
  if (type === 'point' && !l.pos) l.pos = [0, 2, 0];
  return l;
}

function parseMat(ast, args, line) {
  const [name, ...rest] = args;
  if (!name || !IDENT.test(name)) throw new TinyThreeError('mat needs a name', line, 'mat wood #8b5a2b r=.7');
  const m = { name, line, color: 0xcccccc, colorSet: false, r: null, m: null, glow: 0, glowColor: null, op: 1, wire: false, flat: false, double: false, map: null, rep: null };
  for (const t of rest) {
    const p = kv(t);
    if (t.startsWith('#')) { m.color = color(t, line); m.colorSet = true; }
    else if (['wire', 'flat', 'double'].includes(t)) m[t] = true;
    else if (p) {
      const [k, v] = p;
      if (k === 'r') m.r = num(v, line); else if (k === 'm') m.m = num(v, line);
      else if (k === 'glow') m.glow = num(v, line); else if (k === 'glowc') m.glowColor = color(v, line);
      else if (k === 'op') m.op = num(v, line);
      else if (k === 'map') {
        if (!v.includes('.') && !TEXTURES.includes(v)) throw new TinyThreeError(`unknown texture "${v}"`, line, suggest(v, TEXTURES));
        m.map = v;
      } else if (k === 'rep') m.rep = list(v, line, 2, 'u,v');
      else throw new TinyThreeError(`unknown material option "${k}"`, line, suggest(k, ['r', 'm', 'glow', 'glowc', 'op', 'map', 'rep']));
    } else throw new TinyThreeError(`unexpected "${t}" in mat`, line, suggest(t, ['wire', 'flat', 'double']));
  }
  if (m.map && !m.colorSet) m.color = 0xffffff; // a texture shows its own colors unless tinted
  ast.mats[name] = m;
}

function parseNode(ast, type, args, line) {
  const n = { type, line, name: null, dims: null, mat: null, color: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1],
    flags: new Set(), label: null, bg: null, copies: null, mirrors: null, lean: [0, 0], bays: null, thick: null, arc: null, seg: null, pts: null, depth: null, src: null, children: type === 'group' ? [] : null };
  let rest = args;
  if (type === 'use') {
    if (!rest[0]) throw new TinyThreeError('use needs an object name', line);
    n.src = rest[0]; rest = rest.slice(1);
    if (n.src.startsWith('lib:')) ensureLib(ast, n.src.slice(4), line);
    if (!ast.names.has(n.src))
      throw new TinyThreeError(`use: no object named "${n.src}" defined above`, line, suggest(n.src, [...ast.names]));
  }
  if (rest[0] && IDENT.test(rest[0]) && !ast.mats[rest[0]] && !FLAGS.includes(rest[0]) && !rest[0].includes('=')) {
    n.name = rest[0]; rest = rest.slice(1);
  }
  if (type === 'text') {
    const i = rest.findIndex((t) => t.startsWith('"'));
    if (i < 0) throw new TinyThreeError('text needs a quoted label', line, 'text title "Hello" @0,2,0');
    n.label = rest[i].slice(1, -1); rest = rest.filter((_, j) => j !== i);
  }
  if (type === 'model') {
    const i = rest.findIndex((t) => !t.includes('=') && !t.startsWith('@') && !t.startsWith('#') && /[./]/.test(t) && !isList(t));
    if (i < 0) throw new TinyThreeError('model needs a file or URL', line, 'model chair chair.glb @0,0,0');
    n.src = rest[i]; rest = rest.filter((_, j) => j !== i);
  }
  let mirror = null, array = null, grid = null, radial = null;
  for (const t of rest) {
    const p = kv(t);
    if (t.startsWith('@')) n.pos = list(t.slice(1), line, 3, 'position x,y,z');
    else if (t.startsWith('#')) n.color = color(t, line);
    else if (FLAGS.includes(t)) n.flags.add(t);
    else if (ast.mats[t]) n.mat = t;
    else if (!p && isList(t)) { if (n.dims) throw new TinyThreeError(`two size values ("${t}")`, line); n.dims = list(t, line); }
    else if (p) {
      const [k, v] = p;
      switch (k) {
        case 'rot': n.rot = list(v, line, 3); break;
        case 'rx': n.rot[0] = num(v, line); break;
        case 'ry': n.rot[1] = num(v, line); break;
        case 'rz': n.rot[2] = num(v, line); break;
        case 's': n.scale = list(v, line, 3); break;
        case 'mirror': if (!/^[xyz]{1,3}$/.test(v)) throw new TinyThreeError(`bad mirror "${v}"`, line, 'use x, z, xz ...'); mirror = v; break;
        case 'array': array = list(v, line, 4, 'n,dx,dy,dz'); break;
        case 'grid': grid = list(v, line, 4, 'nx,nz,dx,dz'); break;
        case 'radial': radial = list(v, line, 2, 'n,radius'); break;
        case 'arc': n.arc = num(v, line); break;
        case 'lean': n.lean = list(v, line, 2, 'dx,dz'); break;
        case 'n': n.bays = Math.max(1, Math.round(num(v, line))); break;
        case 't': n.thick = num(v, line); break;
        case 'seg': n.seg = num(v, line); break;
        case 'pts': n.pts = pairs(v, line); break;
        case 'd': n.depth = num(v, line); break;
        case 'name': n.name = v; break;
        case 'bg': n.bg = color(v, line); break;
        default: throw new TinyThreeError(`unknown option "${k}"`, line, suggest(k, NODE_KEYS));
      }
    } else if (IDENT.test(t)) throw new TinyThreeError(`unknown material or flag "${t}"`, line,
      suggest(t, [...Object.keys(ast.mats), ...FLAGS]));
    else throw new TinyThreeError(`unexpected "${t}"`, line);
  }
  if ((type === 'lathe' || type === 'extrude') && !n.pts)
    throw new TinyThreeError(`${type} needs pts=`, line, type === 'lathe' ? 'pts=0,0;.5,0;.3,1' : 'pts=0,0;1,0;1,1 d=.2');
  if (n.name) {
    if (ast.names.has(n.name)) throw new TinyThreeError(`duplicate name "${n.name}"`, line);
    if (ast.mats[n.name]) throw new TinyThreeError(`"${n.name}" is already a material name`, line);
    ast.names.add(n.name);
  }
  // copies (mirror / array / grid / radial) are expanded to a list of positions at compile time
  if (mirror || array || grid || radial) {
    // each entry: [x, y, z, extra ry, mirror sign x, y, z]
    let ps = [[...n.pos, 0, 1, 1, 1]];
    if (mirror) for (const ax of mirror) {
      const k = 'xyz'.indexOf(ax);
      ps = ps.flatMap((p) => { const q = p.slice(); q[k] = -q[k]; q[4 + k] = -q[4 + k]; return q[k] === p[k] ? [p] : [p, q]; });
    }
    if (array) {
      const [c, dx, dy, dz] = array;
      ps = ps.flatMap((p) => Array.from({ length: c }, (_, i) => [p[0] + i * dx, p[1] + i * dy, p[2] + i * dz, ...p.slice(3)]));
    }
    if (grid) {
      const [nx, nz, dx, dz] = grid;
      ps = ps.flatMap((p) => Array.from({ length: nx * nz }, (_, i) => [p[0] + (i % nx) * dx, p[1], p[2] + Math.floor(i / nx) * dz, ...p.slice(3)]));
    }
    if (radial) {
      // n copies on a circle around the position (XZ plane); each copy is turned to face outward
      const [c, r] = radial;
      ps = ps.flatMap((p) => Array.from({ length: c }, (_, i) => {
        const a = (i / c) * 2 * Math.PI;
        return [p[0] + r * Math.cos(a), p[1], p[2] + r * Math.sin(a), p[3] - (i / c) * 360, ...p.slice(4)];
      }));
    }
    const r6 = (v) => +v.toFixed(6);
    n.copies = ps.map((p) => (radial ? p.slice(0, 4) : p.slice(0, 3)).map(r6));
    n.mirrors = ps.map((p) => p.slice(4));
  }
  return n;
}

const ANIM_PROPS = ['pos.x', 'pos.y', 'pos.z', 'rot.x', 'rot.y', 'rot.z', 's', 'glow', 'op', 'orbit'];
const EASES = ['io', 'in', 'out', 'lin'];

function parseAnim(args, line) {
  const [target, prop, kind, ...rest] = args;
  if (!target || !prop || !kind) throw new TinyThreeError('anim needs: target prop kind ...', line, 'anim ring rot.y spin 4s');
  if (target === 'cam' && prop === 'orbit') {
    // anim cam orbit 12s
    return { target, prop, kind: 'orbit', period: time(kind, line), line };
  }
  if (!ANIM_PROPS.includes(prop)) throw new TinyThreeError(`unknown anim property "${prop}"`, line, suggest(prop, ANIM_PROPS));
  const a = { target, prop, kind, line };
  const pos = rest.filter((t) => !t.includes('='));
  const opt = Object.fromEntries(rest.filter((t) => t.includes('=')).map(kv));
  switch (kind) {
    case 'spin': a.period = time(pos[0] ?? '4s', line); break;
    case 'wave': a.amp = num(pos[0] ?? '1', line); a.period = time(pos[1] ?? '2s', line); break;
    case 'to':
      a.value = num(pos[0], line, 'target value');
      a.dur = time(pos[1] ?? '1s', line);
      a.at = time(opt.at ?? '0', line);
      a.ease = opt.ease ?? 'io';
      if (!EASES.includes(a.ease)) throw new TinyThreeError(`unknown ease "${a.ease}"`, line, suggest(a.ease, EASES));
      break;
    default: throw new TinyThreeError(`unknown anim kind "${kind}"`, line, suggest(kind, ['spin', 'wave', 'to']));
  }
  return a;
}

/* ------------------------------------------------------------------ codegen */

const hex = (c) => '0x' + c.toString(16).padStart(6, '0');
const f = (v) => +(+v).toFixed(6);
const vec = (a) => a.map(f).join(', ');
const D2R = Math.PI / 180;

function geometry(n) {
  const d = n.dims || [];
  const seg = n.seg;
  switch (n.type) {
    case 'box': { const [w = 1, h = w, dd = w] = d; return `new THREE.BoxGeometry(${vec([w, h, dd])})`; }
    case 'sphere': return `new THREE.SphereGeometry(${f(d[0] ?? 0.5)}, ${seg ?? 32}, ${Math.max(8, Math.round((seg ?? 32) / 2))})`;
    case 'cyl': { const [rt = 0.5, rb = rt, h = 1] = d.length === 2 ? [d[0], d[0], d[1]] : d; return `new THREE.CylinderGeometry(${vec([rt, rb, h])}, ${seg ?? 32})`; }
    case 'cone': { const [r = 0.5, h = 1] = d; return `new THREE.ConeGeometry(${vec([r, h])}, ${seg ?? 32})`; }
    case 'torus': { const [R = 0.5, r = 0.15] = d; return `new THREE.TorusGeometry(${vec([R, r])}, ${Math.max(8, Math.round((seg ?? 64) / 4))}, ${seg ?? 64}${n.arc !== null ? `, ${f(n.arc * D2R)}` : ''})`; }
    case 'plane': { const [w = 1, h = w] = d; return `new THREE.PlaneGeometry(${vec([w, h])})`; }
    case 'capsule': { const [r = 0.25, l = 0.5] = d; return `new THREE.CapsuleGeometry(${vec([r, l])}, 8, ${seg ?? 16})`; }
    case 'lathe': return `new THREE.LatheGeometry([${n.pts.map(([x, y]) => `new THREE.Vector2(${f(x)}, ${f(y)})`).join(', ')}], ${seg ?? 48})`;
    case 'extrude': {
      const [p0, ...ps] = n.pts;
      return `(() => { const s = new THREE.Shape(); s.moveTo(${vec(p0)}); ${ps.map((p) => `s.lineTo(${vec(p)});`).join(' ')} ` +
        `return new THREE.ExtrudeGeometry(s, { depth: ${f(n.depth ?? 0.2)}, bevelEnabled: false }); })()`;
    }
  }
}

export function compile(src, { format = 'esm', base = '' } = {}) {
  // base: prefix for relative model/texture paths (e.g. the folder the .t3 file was loaded from)
  const url = (u) => (base && !/^([a-z]+:|\/)/i.test(u) ? base + u : u);
  const ast = typeof src === 'string' ? parse(src) : src;
  const S = ast.scene;
  const out = [];
  const w = (s = '') => out.push(s);
  let uid = 0;
  const v = (p) => `_${p}${uid++}`;

  w(`// generated by tinythree ${VERSION} — https://github.com/muskec06/tinythree`);
  w(`${format === 'esm' ? 'export default ' : ''}function build(THREE) {`);
  w(`  const O = {}, M = {}, deg = Math.PI / 180;`);
  w(`  const scene = new THREE.Scene();`);
  if (S.bg !== null) w(`  scene.background = new THREE.Color(${hex(S.bg)});`);
  if (S.fog) w(`  scene.fog = new THREE.Fog(${hex(S.fog[0])}, ${f(S.fog[1])}, ${f(S.fog[2])});`);
  if (S.ortho) {
    const a = S.size[0] / S.size[1], h = S.ortho / 2;
    w(`  let camera = new THREE.OrthographicCamera(${f(-h * a)}, ${f(h * a)}, ${f(h)}, ${f(-h)}, 0.1, 1000);`);
  } else w(`  let camera = new THREE.PerspectiveCamera(${f(S.fov)}, ${f(S.size[0] / S.size[1])}, 0.1, 1000);`);
  // wait(promise): register async work (models, textures, imports) that video rendering must wait for
  w(`  const _pending = []; const wait = (p) => (_pending.push(Promise.resolve(p)), p);`);
  w(`  camera.position.set(${vec(S.cam)});`);
  w(`  camera.lookAt(${vec(S.look)});`);
  if (S.grid) w(`  scene.add(new THREE.GridHelper(20, 20, 0x335577, 0x223344));`);
  if (S.axes) w(`  scene.add(new THREE.AxesHelper(2));`);

  // materials
  w(`  M._default = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 });`);
  const matCode = (m) => {
    const o = [`color: ${hex(m.color)}`];
    if (m.r !== null) o.push(`roughness: ${f(m.r)}`);
    if (m.m !== null) o.push(`metalness: ${f(m.m)}`);
    if (m.glow) o.push(`emissive: ${hex(m.glowColor ?? m.color)}`, `emissiveIntensity: ${f(m.glow)}`);
    if (m.op < 1) o.push(`transparent: true`, `opacity: ${f(m.op)}`);
    if (m.wire) o.push('wireframe: true');
    if (m.flat) o.push('flatShading: true');
    if (m.double) o.push('side: THREE.DoubleSide');
    return `new THREE.MeshStandardMaterial({ ${o.join(', ')} })`;
  };
  const usesMap = Object.values(ast.mats).some((m) => m.map);
  if (usesMap) {
    // procedural textures are drawn on a canvas with a fixed seed, so videos are identical every run
    w(`  function proc(kind) {`);
    w(`    if (typeof document === 'undefined') return null;`);
    w(`    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');`);
    w(`    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;`);
    w(`    const fill = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };`);
    w(`    if (kind === 'checker') for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) fill((i + j) % 2 ? '#222' : '#eee', i * 32, j * 32, 32, 32);`);
    w(`    else if (kind === 'grid') { fill('#f4f4f4', 0, 0, 256, 256); for (let i = 0; i <= 256; i += 32) { fill('#9aa', i, 0, 2, 256); fill('#9aa', 0, i, 256, 2); } }`);
    w(`    else if (kind === 'brick') { fill('#c9c3b8', 0, 0, 256, 256); for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) fill(\`hsl(\${10 + rnd() * 10},55%,\${36 + rnd() * 10}%)\`, k * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); }`);
    w(`    else if (kind === 'tiles') { fill('#a49a88', 0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) fill(\`hsl(38,25%,\${70 + rnd() * 10}%)\`, i * 64 + 2, j * 64 + 2, 60, 60); }`);
    w(`    else if (kind === 'wood') { fill('#9a6a3e', 0, 0, 256, 256); for (let y = 0; y < 256; y += 4) fill(\`rgba(60,30,10,\${rnd() * .35})\`, 0, y, 256, 2 + rnd() * 3); }`);
    w(`    else { const base = kind === 'grass' ? [74, 130, 58] : [128, 128, 128]; const d = g.createImageData(256, 256);`);
    w(`      for (let i = 0; i < d.data.length; i += 4) { const k = .8 + rnd() * .4; d.data[i] = base[0] * k; d.data[i + 1] = base[1] * k; d.data[i + 2] = base[2] * k; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }`);
    w(`    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;`);
    w(`  }`);
    w(`  function tex(mat, src, ru, rv) {`);
    w(`    const set = (t) => { if (!t) return; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ru, rv); t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; };`);
    w(`    if (!/[./]/.test(src)) return set(proc(src));`);
    w(`    wait(new THREE.TextureLoader().loadAsync(src).then(set).catch((e) => console.warn('tinythree: could not load ' + src, e)));`);
    w(`  }`);
  }
  for (const m of Object.values(ast.mats)) {
    w(`  M[${JSON.stringify(m.name)}] = ${matCode(m)};`);
    if (m.map) w(`  tex(M[${JSON.stringify(m.name)}], ${JSON.stringify(m.map.includes('.') ? url(m.map) : m.map)}, ${f(m.rep?.[0] ?? 1)}, ${f(m.rep?.[1] ?? 1)});`);
  }
  const inlineMats = new Map();
  const matFor = (n) => {
    if (n.mat) return `M[${JSON.stringify(n.mat)}]`;
    if (n.color !== null) {
      if (!inlineMats.has(n.color)) {
        const id = `M._c${n.color.toString(16)}`;
        inlineMats.set(n.color, id);
        w(`  ${id} = new THREE.MeshStandardMaterial({ color: ${hex(n.color)}, roughness: 0.6 });`);
      }
      return inlineMats.get(n.color);
    }
    return 'M._default';
  };

  // helper
  w(`  function place(o, p, r, s, parent) {`);
  w(`    o.position.set(p[0], p[1], p[2]); o.rotation.set(r[0] * deg, r[1] * deg, r[2] * deg); o.scale.set(s[0], s[1], s[2]);`);
  w(`    parent.add(o); return o;`);
  w(`  }`);
  w(`  function mesh(geo, mat, cast, recv) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }`);

  const emitLight = (l, parent) => {
    const n = v('light');
    if (l.type === 'amb') w(`  ${parent}.add(new THREE.AmbientLight(${hex(l.color)}, ${f(l.intensity)}));`);
    else if (l.type === 'hemi') w(`  ${parent}.add(new THREE.HemisphereLight(${hex(l.color)}, ${hex(l.ground)}, ${f(l.intensity)}));`);
    else if (l.type === 'sun') {
      w(`  const ${n} = new THREE.DirectionalLight(${hex(l.color)}, ${f(l.intensity)});`);
      w(`  ${n}.position.set(${vec(l.pos)});`);
      if (S.shadows) {
        w(`  ${n}.castShadow = true; ${n}.shadow.mapSize.set(2048, 2048); ${n}.shadow.bias = -0.0005;`);
        w(`  Object.assign(${n}.shadow.camera, { left: ${-l.area}, right: ${l.area}, top: ${l.area}, bottom: ${-l.area}, far: ${l.area * 6} });`);
      }
      w(`  ${parent}.add(${n});`);
    } else if (l.type === 'point') {
      w(`  const ${n} = new THREE.PointLight(${hex(l.color)}, ${f(l.intensity)}, ${f(l.dist)});`);
      w(`  ${n}.position.set(${vec(l.pos)});`);
      w(`  ${parent}.add(${n});`);
    }
  };
  const uses = (type, nodes = ast.nodes) => nodes.some((n) => n.type === type || (n.children && uses(type, n.children)));
  if (uses('text')) {
    // labels are canvas sprites: they face the camera and show up in rendered videos
    w(`  function label(text, color, bg, top) {`);
    w(`    const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: !top, transparent: true }));`);
    w(`    if (typeof document === 'undefined') return s;`);
    w(`    const c = document.createElement('canvas'), g = c.getContext('2d'), font = 'bold 96px system-ui, sans-serif';`);
    w(`    g.font = font; const w = Math.ceil(g.measureText(text).width) + 48; c.width = w; c.height = 128;`);
    w(`    if (bg !== null) { g.fillStyle = '#' + bg.toString(16).padStart(6, '0'); g.beginPath(); g.roundRect(0, 0, w, 128, 28); g.fill(); }`);
    w(`    g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillText(text, 24, 68);`);
    w(`    s.material.map = new THREE.CanvasTexture(c); s.material.map.colorSpace = THREE.SRGBColorSpace;`);
    w(`    s.geometry = s.geometry.clone().scale(w / 128, 1, 1); if (top) s.renderOrder = 999;`);
    w(`    return s;`);
    w(`  }`);
  }
  if (uses('model')) {
    w(`  const _mixers = [];`);
    w(`  function model(url, play, cast) {`);
    w(`    const holder = new THREE.Group();`);
    // Draco- and meshopt-compressed files (common from Blender and Sketchfab) load too; the Draco
    // decoder comes from the same three.js the page uses
    w(`    const base = globalThis.TINYTHREE_THREE_URL || ${JSON.stringify(DEFAULT_THREE_URL)};`);
    w(`    wait(Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')])`);
    w(`      .then(([{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }]) => new GLTFLoader()`);
    w(`        .setDRACOLoader(new DRACOLoader().setDecoderPath(base + 'examples/jsm/libs/draco/gltf/'))`);
    w(`        .setMeshoptDecoder(MeshoptDecoder).loadAsync(url)).then((g) => {`);
    w(`      g.scene.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = cast; });`);
    w(`      holder.add(g.scene);`);
    w(`      if (play && g.animations.length) { const mx = new THREE.AnimationMixer(g.scene); g.animations.forEach((c) => mx.clipAction(c).play()); _mixers.push(mx); }`);
    w(`    }).catch((e) => { (globalThis.tinythreeErrors ||= []).push('could not load ' + url + ': ' + (e && e.message || e)); console.warn('tinythree: could not load ' + url, e); }));`);
    w(`    return holder;`);
    w(`  }`);
  }
  const usesTruss = (nodes) => nodes.some((n) => n.type === 'truss' || (n.children && usesTruss(n.children)));
  if (usesTruss(ast.nodes)) {
    // lattice tower segment: 4 corner posts, a ring per bay and X braces on every face,
    // drawn as one InstancedMesh. Base center at the origin; top center shifted by (lx, lz).
    w(`  const _beam = new THREE.BoxGeometry(1, 1, 1), _up = new THREE.Vector3(0, 1, 0), _o = new THREE.Object3D();`);
    w(`  function truss(w0, w1, h, n, t, lx, lz, mat, cast) {`);
    w(`    const C = [[1, 1], [-1, 1], [-1, -1], [1, -1]];`);
    w(`    const P = (k, y) => { const f = y / h, hw = (w0 + (w1 - w0) * f) / 2; return new THREE.Vector3(lx * f + C[k][0] * hw, y, lz * f + C[k][1] * hw); };`);
    w(`    const B = [];`);
    w(`    for (let i = 0; i < n; i++) {`);
    w(`      const y0 = (i * h) / n, y1 = ((i + 1) * h) / n;`);
    w(`      for (let k = 0; k < 4; k++) {`);
    w(`        const j = (k + 1) % 4;`);
    w(`        B.push([P(k, y0), P(k, y1), t * 2.2], [P(k, y1), P(j, y1), t], [P(k, y0), P(j, y1), t * 0.7], [P(j, y0), P(k, y1), t * 0.7]);`);
    w(`        if (i === 0) B.push([P(k, y0), P(j, y0), t]);`);
    w(`      }`);
    w(`    }`);
    w(`    const m = new THREE.InstancedMesh(_beam, mat, B.length);`);
    w(`    B.forEach(([a, b, th], i) => {`);
    w(`      const d = b.clone().sub(a), len = d.length();`);
    w(`      _o.position.copy(a).addScaledVector(d, 0.5);`);
    w(`      _o.quaternion.setFromUnitVectors(_up, d.normalize());`);
    w(`      _o.scale.set(th, len, th);`);
    w(`      _o.updateMatrix(); m.setMatrixAt(i, _o.matrix);`);
    w(`    });`);
    w(`    m.computeBoundingSphere(); m.castShadow = m.receiveShadow = cast;`);
    w(`    return m;`);
    w(`  }`);
  }
  function trussCall(n, sign) {
    const [w0 = 1, w1 = w0, h = 2] = n.dims || [];
    const bays = n.bays ?? Math.max(1, Math.round(h / Math.max(0.01, ((w0 + w1) / 2) * 0.6)));
    const t = n.thick ?? Math.max(0.01, ((w0 + w1) / 2) * 0.022);
    const shadow = S.shadows && !n.flags.has('noshadow');
    return `truss(${vec([w0, w1, h])}, ${bays}, ${f(t)}, ${sign === null ? 'm[0] * ' : ''}${f(n.lean[0] * (sign?.[0] ?? 1))}, ${sign === null ? 'm[2] * ' : ''}${f(n.lean[1] * (sign?.[2] ?? 1))}, ${matFor(n)}, ${shadow})`;
  }
  const emitNode = (n, parent) => {
    if (n.type === 'light') return emitLight(n.light, parent);
    const id = v(n.type);
    const shadow = S.shadows && !n.flags.has('noshadow');
    let rot = n.rot;
    if (n.flags.has('floor')) rot = [rot[0] - 90, rot[1], rot[2]];
    const make = () => {
      if (n.type === 'group') return `new THREE.Group()`;
      if (n.type === 'use') return `Object.assign(O[${JSON.stringify(n.src)}].clone(), { visible: true })`;
      if (n.type === 'truss') return trussCall(n, [1, 1, 1]);
      if (n.type === 'text') return `label(${JSON.stringify(n.label)}, ${hex(n.color ?? 0xffffff)}, ${n.bg === null ? 'null' : hex(n.bg)}, ${n.flags.has('top')})`;
      if (n.type === 'model') return `model(${JSON.stringify(url(n.src))}, ${n.flags.has('play')}, ${S.shadows && !n.flags.has('noshadow')})`;
      if (n.type === 'arrow') {
        const [dx = 0, dy = 1, dz = 0, len = 1] = n.dims || [];
        // wrapped in a group so rot= on the node does not reset the arrow's own direction
        return `new THREE.Group().add(new THREE.ArrowHelper(new THREE.Vector3(${vec([dx, dy, dz])}).normalize(), new THREE.Vector3(), ${f(len)}, ${hex(n.color ?? 0xffcc00)}, ${f(len * 0.2)}, ${f(len * 0.1)}))`;
      }
      const floor = n.flags.has('floor');
      return `mesh(${geometry(n)}, ${matFor(n)}, ${shadow && !floor}, ${shadow})`;
    };
    if (n.copies && n.type === 'truss') {
      // trusses are rebuilt per copy so mirrored copies lean the mirrored way
      w(`  const ${id} = place(new THREE.Group(), [0, 0, 0], [0, 0, 0], [1, 1, 1], ${parent});`);
      const list = n.copies.map((p, i) => [p, n.mirrors[i]]);
      w(`  for (const [p, m] of ${JSON.stringify(list)}) place(${trussCall(n, null)}, p, [${f(rot[0])}, ${f(rot[1])} + (p[3] || 0), ${f(rot[2])}], [${vec(n.scale)}], ${id});`);
    } else if (n.copies) {
      // one group holds all copies; the group is what the name refers to
      w(`  const ${id} = place(new THREE.Group(), [0, 0, 0], [0, 0, 0], [1, 1, 1], ${parent});`);
      const proto = v('proto');
      w(`  const ${proto} = ${make()};`);
      if (n.children) { n.children.forEach((c) => emitNode(c, proto)); }
      const turned = n.copies.some((p) => p.length > 3);
      w(`  for (const p of ${JSON.stringify(n.copies)}) place(${proto}.clone(), p, [${f(rot[0])}, ${f(rot[1])}${turned ? ' + (p[3] || 0)' : ''}, ${f(rot[2])}], [${vec(n.scale)}], ${id});`);
    } else {
      w(`  const ${id} = place(${make()}, [${vec(n.pos)}], [${vec(rot)}], [${vec(n.scale)}], ${parent});`);
      if (n.children) n.children.forEach((c) => emitNode(c, id));
    }
    if (n.flags.has('hidden')) w(`  ${id}.visible = false;`);
    if (n.name) w(`  O[${JSON.stringify(n.name)}] = ${id};`);
  };
  ast.nodes.forEach((n) => emitNode(n, 'scene'));

  // escape hatch: setup code
  for (const code of ast.js) { w(`  // --- js block`); code.split('\n').forEach((l) => w('  ' + l)); }

  // animation
  const groups = new Map();
  for (const a of ast.anims) {
    const key = `${a.target}|${a.prop}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  const accessor = (target, prop) => {
    const isMat = !!ast.mats[target];
    const obj = target === 'cam' ? 'camera' : isMat ? `M.${target}` : `O[${JSON.stringify(target)}]`;
    switch (prop) {
      case 'pos.x': case 'pos.y': case 'pos.z': return [`${obj}.position.${prop[4]}`, 1];
      case 'rot.x': case 'rot.y': case 'rot.z': return [`${obj}.rotation.${prop[4]}`, D2R];
      case 's': return [`${obj}.scale`, 1, 'scale'];
      case 'glow': return [`${obj}.emissiveIntensity`, 1, isMat ? null : 'needsMat'];
      case 'op': return [`${obj}.opacity`, 1, isMat ? 'opacity' : 'needsMat'];
    }
  };
  const ease = { lin: 'p', in: 'p * p', out: 'p * (2 - p)', io: 'p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2' };

  w(`  const base = {};`);
  const camAnims = [];
  const updates = [];
  for (const [key, as] of groups) {
    const [target, prop] = key.split('|');
    if (prop === 'orbit') {
      const a = as[0];
      camAnims.push(`{ const dx = ${f(S.cam[0] - S.look[0])}, dz = ${f(S.cam[2] - S.look[2])}, r = Math.hypot(dx, dz), a0 = Math.atan2(dz, dx) + t * ${f((2 * Math.PI) / a.period)};` +
        ` camera.position.set(${f(S.look[0])} + Math.cos(a0) * r, ${f(S.cam[1])}, ${f(S.look[2])} + Math.sin(a0) * r); camera.lookAt(${vec(S.look)}); }`);
      continue;
    }
    const [acc, k, special] = accessor(target, prop);
    if (special === 'needsMat') throw new TinyThreeError(`"${prop}" animates a material — use a material name as target`, as[0].line);
    const bkey = JSON.stringify(key);
    const read = special === 'scale' ? `${acc}.x` : acc;
    w(`  base[${bkey}] = ${read};`);
    const tweens = as.filter((a) => a.kind === 'to').sort((a, b) => a.at - b.at);
    const offs = as.filter((a) => a.kind !== 'to');
    const lines = [`{ let v = base[${bkey}];`];
    let from = null;
    for (const tw of tweens) {
      const fromExpr = from === null ? `base[${bkey}]` : f(from);
      lines.push(` if (t >= ${f(tw.at)}) { const p = Math.min(1, (t - ${f(tw.at)}) / ${f(tw.dur || 1e-6)}); v = ${fromExpr} + (${f(tw.value * k)} - ${fromExpr}) * (${ease[tw.ease]}); }`);
      from = tw.value * k;
    }
    for (const o of offs) {
      if (o.kind === 'spin') lines.push(` v += t * ${f((2 * Math.PI) / o.period)};`);
      else lines.push(` v += ${f(o.amp * k)} * Math.sin(t * ${f((2 * Math.PI) / o.period)});`);
    }
    const set = special === 'scale' ? `${acc}.setScalar(v);` : `${acc} = v;`;
    lines.push(` ${set} }`);
    (target === 'cam' ? camAnims : updates).push(lines.join(''));
  }

  w(`  function update(t, animateCamera = true) {`);
  if (uses('model')) w(`    for (const mx of _mixers) mx.setTime(t);`);
  for (const u of updates) w(`    ${u}`);
  if (camAnims.length) { w(`    if (animateCamera) {`); camAnims.forEach((u) => w(`      ${u}`)); w(`    }`); }
  for (const code of ast.tick) { w(`    // --- tick block`); code.split('\n').forEach((l) => w('    ' + l)); }
  w(`  }`);
  // renderer blocks run once inside mount(), with the WebGLRenderer available
  w(`  function host(renderer, H) {`);
  if (ast.host.length) {
    w(`    const draw = (fn) => { H.draw = fn; }, onResize = (fn) => { H.resize = fn; };`);
    for (const code of ast.host) { w(`    // --- renderer block`); code.split('\n').forEach((l) => w('    ' + l)); }
  }
  w(`  }`);
  const opts = { orbit: S.orbit, shadows: S.shadows, look: S.look, dur: S.dur, size: S.size, transparent: S.transparent, ortho: S.ortho, camAnim: camAnims.length > 0 };
  w(`  return { scene, camera, update, host, ready: () => Promise.all(_pending), objects: O, materials: M, opts: ${JSON.stringify(opts)} };`);
  w(`}`);
  return out.join('\n');
}

/* ------------------------------------------------------------------ runtime host */

// mount() is self-contained so it can be inlined into standalone HTML via toString().
export function mount(THREE, built, el, { OrbitControls = null, autoplay = true, width = 0, height = 0 } = {}) {
  const { scene, camera, update, opts } = built;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.transparent, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !!opts.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if (opts.transparent) renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);
  // H: hooks a `renderer` block can set — draw() replaces renderer.render (post-processing, extra renderers), resize(w, h)
  const H = { draw: null, resize: null };
  if (built.host) built.host(renderer, H);
  let controls = null, userCam = false;
  if (opts.orbit && OrbitControls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(opts.look[0], opts.look[1], opts.look[2]);
    controls.enableDamping = true;
    controls.addEventListener('start', () => { userCam = true; });
  }
  const resize = (w = width || el.clientWidth || innerWidth, h = height || el.clientHeight || innerHeight) => {
    renderer.setSize(w, h);
    if (camera.isOrthographicCamera) {
      const half = (camera.top - camera.bottom) / 2;
      camera.left = -half * (w / h); camera.right = half * (w / h);
    } else camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (H.resize) H.resize(w, h);
  };
  resize();
  const onResize = () => { if (!width) resize(); };
  addEventListener('resize', onResize);
  let t = 0, last = performance.now(), playing = autoplay, looping = false;
  const frame = () => {
    update(t, !userCam);
    if (controls) controls.update();
    if (H.draw) H.draw(t); else renderer.render(scene, camera);
  };
  const loop = (now) => {
    if (playing) t += Math.min(0.1, (now - last) / 1000);
    last = now;
    frame();
  };
  const start = () => { if (!looping) { looping = true; last = performance.now(); renderer.setAnimationLoop(loop); } };
  update(0, true); frame();
  if (autoplay) start();
  return {
    renderer, scene, camera, controls, duration: opts.dur, size: opts.size,
    seek(time) { t = time; frame(); },
    play() { playing = true; start(); },
    pause() { playing = false; },
    get time() { return t; },
    whenReady() { return (built.ready ? built.ready() : Promise.resolve()).then(() => frame()); },
    resize,
    dispose() { renderer.setAnimationLoop(null); removeEventListener('resize', onResize); controls?.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}

/* ------------------------------------------------------------------ standalone html */

export function toHTML(src, { threeUrl = DEFAULT_THREE_URL, title = 'tinythree scene', base = '' } = {}) {
  const ast = parse(src);
  const code = compile(ast, { format: 'fn', base });
  const bg = ast.scene.transparent ? 'transparent' : '#' + ast.scene.bg.toString(16).padStart(6, '0');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"${threeUrl}build/three.module.js","three/addons/":"${threeUrl}examples/jsm/"}}</script>
<script>window.TINYTHREE_THREE_URL = ${JSON.stringify(threeUrl)};</script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
${code}
${mount.toString()}
const q = new URLSearchParams(location.search);
const render = q.has('render');
const built = build(THREE);
const [w, h] = render ? built.opts.size : [0, 0];
window.tinythree = mount(THREE, built, document.body, { OrbitControls: render ? null : OrbitControls, autoplay: !render, width: w, height: h });
window.tinythree.whenReady().then(() => { window.tinythree.ready = true; }, (e) => { console.error(e); window.tinythree.ready = true; });
</script>
</body>
</html>
`;
}
