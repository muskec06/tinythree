// tinythree — a tiny, token-efficient 3D scene language that compiles to Three.js.
// Zero dependencies. Runs in the browser and in Node (ESM).
// https://github.com/muskec06/tinythree  ·  MIT License

export const VERSION = '0.2.0';
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
const PRIMS = ['box', 'sphere', 'cyl', 'cone', 'torus', 'plane', 'capsule', 'lathe', 'extrude', 'arrow'];
const COMMANDS = ['scene', 'amb', 'hemi', 'sun', 'point', 'mat', 'group', 'use', 'anim', 'js', 'tick', ...PRIMS];
const FLAGS = ['floor', 'noshadow', 'hidden'];
const NODE_KEYS = ['rot', 'rx', 'ry', 'rz', 's', 'mirror', 'array', 'grid', 'radial', 'arc', 'seg', 'pts', 'd', 'name'];

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
    const noComment = raw.replace(/\s*\/\/.*$/, '');
    const indent = (noComment.match(/^[ \t]*/)[0] || '').replace(/\t/g, '  ').length;
    const text = noComment.trim();
    out.push({ line, indent, text, raw, tokens: text ? text.split(/\s+/) : [] });
  });
  return out;
}

/* ------------------------------------------------------------------ parsing */

export function parse(src) {
  const lines = lex(src);
  const ast = {
    scene: { bg: 0x101418, cam: [4, 3, 6], look: [0, 0, 0], fov: 50, orbit: false, shadows: false,
      grid: false, axes: false, fog: null, dur: 0, size: [1280, 720], transparent: false },
    mats: {}, nodes: [], anims: [], js: [], tick: [], names: new Set(),
  };
  const stack = [{ indent: -1, children: ast.nodes }];

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!L.tokens.length) continue;
    const [cmd, ...args] = L.tokens;
    const line = L.line;

    if (cmd === 'js' || cmd === 'tick') {
      const body = [];
      while (i + 1 < lines.length && (lines[i + 1].indent > L.indent || !lines[i + 1].text)) {
        i++;
        body.push(lines[i].raw.replace(/^\s{0,2}/, ''));
      }
      (cmd === 'js' ? ast.js : ast.tick).push(body.join('\n'));
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
      case 'dur': s.dur = time(v, line); break;
      case 'size': s.size = list(v, line, 2); break;
      case 'fog': { const [c, n, f] = v.split(','); s.fog = [color(c, line), num(n ?? '5', line), num(f ?? '40', line)]; break; }
      default: throw new TinyThreeError(`unknown scene option "${k}"`, line,
        suggest(k, ['bg', 'cam', 'look', 'fov', 'dur', 'size', 'fog']));
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
  const m = { name, line, color: 0xcccccc, r: null, m: null, glow: 0, glowColor: null, op: 1, wire: false, flat: false, double: false };
  for (const t of rest) {
    const p = kv(t);
    if (t.startsWith('#')) m.color = color(t, line);
    else if (['wire', 'flat', 'double'].includes(t)) m[t] = true;
    else if (p) {
      const [k, v] = p;
      if (k === 'r') m.r = num(v, line); else if (k === 'm') m.m = num(v, line);
      else if (k === 'glow') m.glow = num(v, line); else if (k === 'glowc') m.glowColor = color(v, line);
      else if (k === 'op') m.op = num(v, line);
      else throw new TinyThreeError(`unknown material option "${k}"`, line, suggest(k, ['r', 'm', 'glow', 'glowc', 'op']));
    } else throw new TinyThreeError(`unexpected "${t}" in mat`, line, suggest(t, ['wire', 'flat', 'double']));
  }
  ast.mats[name] = m;
}

function parseNode(ast, type, args, line) {
  const n = { type, line, name: null, dims: null, mat: null, color: null, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1],
    flags: new Set(), copies: null, arc: null, seg: null, pts: null, depth: null, src: null, children: type === 'group' ? [] : null };
  let rest = args;
  if (type === 'use') {
    if (!rest[0]) throw new TinyThreeError('use needs an object name', line);
    n.src = rest[0]; rest = rest.slice(1);
    if (!ast.names.has(n.src))
      throw new TinyThreeError(`use: no object named "${n.src}" defined above`, line, suggest(n.src, [...ast.names]));
  }
  if (rest[0] && IDENT.test(rest[0]) && !ast.mats[rest[0]] && !FLAGS.includes(rest[0]) && !rest[0].includes('=')) {
    n.name = rest[0]; rest = rest.slice(1);
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
        case 'seg': n.seg = num(v, line); break;
        case 'pts': n.pts = pairs(v, line); break;
        case 'd': n.depth = num(v, line); break;
        case 'name': n.name = v; break;
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
    let ps = [n.pos.slice()];
    if (mirror) for (const ax of mirror) {
      const k = 'xyz'.indexOf(ax);
      ps = ps.flatMap((p) => { const q = p.slice(); q[k] = -q[k]; return q[k] === p[k] ? [p] : [p, q]; });
    }
    if (array) {
      const [c, dx, dy, dz] = array;
      ps = ps.flatMap((p) => Array.from({ length: c }, (_, i) => [p[0] + i * dx, p[1] + i * dy, p[2] + i * dz]));
    }
    if (grid) {
      const [nx, nz, dx, dz] = grid;
      ps = ps.flatMap((p) => Array.from({ length: nx * nz }, (_, i) => [p[0] + (i % nx) * dx, p[1], p[2] + Math.floor(i / nx) * dz]));
    }
    if (radial) {
      // n copies on a circle around the position (XZ plane); each copy is turned to face outward
      const [c, r] = radial;
      ps = ps.flatMap((p) => Array.from({ length: c }, (_, i) => {
        const a = (i / c) * 2 * Math.PI;
        return [p[0] + r * Math.cos(a), p[1], p[2] + r * Math.sin(a), -(i / c) * 360];
      }));
    }
    n.copies = ps.map((p) => p.map((v) => +v.toFixed(6)));
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

export function compile(src, { format = 'esm' } = {}) {
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
  w(`  const camera = new THREE.PerspectiveCamera(${f(S.fov)}, ${f(S.size[0] / S.size[1])}, 0.1, 1000);`);
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
  for (const m of Object.values(ast.mats)) w(`  M.${m.name} = ${matCode(m)};`);
  const inlineMats = new Map();
  const matFor = (n) => {
    if (n.mat) return `M.${n.mat}`;
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
  const emitNode = (n, parent) => {
    if (n.type === 'light') return emitLight(n.light, parent);
    const id = v(n.type);
    const shadow = S.shadows && !n.flags.has('noshadow');
    let rot = n.rot;
    if (n.flags.has('floor')) rot = [rot[0] - 90, rot[1], rot[2]];
    const make = () => {
      if (n.type === 'group') return `new THREE.Group()`;
      if (n.type === 'use') return `Object.assign(O[${JSON.stringify(n.src)}].clone(), { visible: true })`;
      if (n.type === 'arrow') {
        const [dx = 0, dy = 1, dz = 0, len = 1] = n.dims || [];
        // wrapped in a group so rot= on the node does not reset the arrow's own direction
        return `new THREE.Group().add(new THREE.ArrowHelper(new THREE.Vector3(${vec([dx, dy, dz])}).normalize(), new THREE.Vector3(), ${f(len)}, ${hex(n.color ?? 0xffcc00)}, ${f(len * 0.2)}, ${f(len * 0.1)}))`;
      }
      const floor = n.flags.has('floor');
      return `mesh(${geometry(n)}, ${matFor(n)}, ${shadow && !floor}, ${shadow})`;
    };
    if (n.copies) {
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
  for (const u of updates) w(`    ${u}`);
  if (camAnims.length) { w(`    if (animateCamera) {`); camAnims.forEach((u) => w(`      ${u}`)); w(`    }`); }
  for (const code of ast.tick) { w(`    // --- tick block`); code.split('\n').forEach((l) => w('    ' + l)); }
  w(`  }`);
  const opts = { orbit: S.orbit, shadows: S.shadows, look: S.look, dur: S.dur, size: S.size, transparent: S.transparent, camAnim: camAnims.length > 0 };
  w(`  return { scene, camera, update, objects: O, materials: M, opts: ${JSON.stringify(opts)} };`);
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
  let controls = null, userCam = false;
  if (opts.orbit && OrbitControls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(opts.look[0], opts.look[1], opts.look[2]);
    controls.enableDamping = true;
    controls.addEventListener('start', () => { userCam = true; });
  }
  const resize = (w = width || el.clientWidth || innerWidth, h = height || el.clientHeight || innerHeight) => {
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  const onResize = () => { if (!width) resize(); };
  addEventListener('resize', onResize);
  let t = 0, last = performance.now(), playing = autoplay, raf = 0;
  const frame = () => {
    update(t, !userCam);
    if (controls) controls.update();
    renderer.render(scene, camera);
  };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (playing) t += Math.min(0.1, (now - last) / 1000);
    last = now;
    frame();
  };
  update(0, true); frame();
  if (autoplay) raf = requestAnimationFrame(loop);
  return {
    renderer, scene, camera, controls, duration: opts.dur, size: opts.size,
    seek(time) { t = time; frame(); },
    play() { playing = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); },
    pause() { playing = false; },
    get time() { return t; },
    resize,
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); controls?.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}

/* ------------------------------------------------------------------ standalone html */

export function toHTML(src, { threeUrl = DEFAULT_THREE_URL, title = 'tinythree scene' } = {}) {
  const ast = parse(src);
  const code = compile(ast, { format: 'fn' });
  const bg = ast.scene.transparent ? 'transparent' : '#' + ast.scene.bg.toString(16).padStart(6, '0');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:${bg}}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"${threeUrl}build/three.module.js","three/addons/":"${threeUrl}examples/jsm/"}}</script>
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
window.tinythree.ready = true;
</script>
</body>
</html>
`;
}
