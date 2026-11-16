import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { parse, compile, toHTML, TinyThreeError } from '../src/tinythree.js';

const build = (src) => new Function('THREE', compile(src, { format: 'fn' }) + '\nreturn build(THREE);')(THREE);
const throws = (src, re) => assert.throws(() => compile(src), (e) => e instanceof TinyThreeError && re.test(e.message));

test('every example compiles and builds a scene', () => {
  for (const f of fs.readdirSync('examples').filter((f) => f.endsWith('.t3'))) {
    const b = build(fs.readFileSync(`examples/${f}`, 'utf8'));
    assert.ok(b.scene.children.length > 0, f);
    b.update(0); b.update(3.7);
  }
});

test('position, rotation, scale and material', () => {
  const b = build('mat red #f00 r=.5\nbox a 1,2,3 red @1,2,3 ry=90 s=2');
  const a = b.objects.a;
  assert.deepEqual(a.position.toArray(), [1, 2, 3]);
  assert.ok(Math.abs(a.rotation.y - Math.PI / 2) < 1e-9);
  assert.equal(a.scale.x, 2);
  assert.equal(a.material.color.getHex(), 0xff0000);
  assert.equal(a.material.roughness, 0.5);
  assert.deepEqual(a.geometry.parameters, { width: 1, height: 2, depth: 3, widthSegments: 1, heightSegments: 1, depthSegments: 1 });
});

test('groups nest by indentation', () => {
  const b = build('group g @0,1,0\n  box a\n  group h\n    box c\nbox d');
  assert.equal(b.objects.a.parent, b.objects.g);
  assert.equal(b.objects.c.parent, b.objects.h);
  assert.equal(b.objects.h.parent, b.objects.g);
  assert.equal(b.objects.d.parent, b.scene);
});

test('mirror, array and grid expand to copies', () => {
  const b = build('box m @1,0,2 mirror=xz\nbox a @0,0,0 array=3,1,0,0\nbox g grid=2,3,1,1');
  assert.equal(b.objects.m.children.length, 4);
  assert.equal(b.objects.a.children.length, 3);
  assert.deepEqual(b.objects.a.children[2].position.toArray(), [2, 0, 0]);
  assert.equal(b.objects.g.children.length, 6);
});

test('use clones a hidden template as visible', () => {
  const b = build('group t hidden\n  box a\nuse t c @5,0,0');
  assert.equal(b.objects.t.visible, false);
  assert.equal(b.objects.c.visible, true);
  assert.equal(b.objects.c.position.x, 5);
});

test('animations are a pure function of time', () => {
  const b = build('box a\nmat n #fff glow=1\nanim a rot.y spin 4s\nanim a pos.y to 2 1s at=1s ease=lin\nanim n glow wave .5 2s');
  b.update(2);
  assert.ok(Math.abs(b.objects.a.rotation.y - Math.PI) < 1e-6);
  assert.equal(b.objects.a.position.y, 2);
  b.update(1.5);
  assert.ok(Math.abs(b.objects.a.position.y - 1) < 1e-6);
  b.update(0.5);
  assert.ok(Math.abs(b.materials.n.emissiveIntensity - 1.5) < 1e-6);
});

test('chained tweens start where the previous one ended', () => {
  const b = build('box a\nanim a pos.x to 4 1s ease=lin\nanim a pos.x to 0 1s at=2s ease=lin');
  b.update(1.5); assert.equal(b.objects.a.position.x, 4);
  b.update(2.5); assert.equal(b.objects.a.position.x, 2);
});

test('camera orbit keeps radius and height', () => {
  const b = build('scene cam=3,2,4\nanim cam orbit 8s');
  b.update(2);
  assert.ok(Math.abs(Math.hypot(b.camera.position.x, b.camera.position.z) - 5) < 1e-6);
  assert.equal(b.camera.position.y, 2);
});

test('js and tick escape hatches', () => {
  const b = build('box a\njs\n  O.a.userData.ok = 1\ntick\n  O.a.position.z = t * 2');
  assert.equal(b.objects.a.userData.ok, 1);
  b.update(3); assert.equal(b.objects.a.position.z, 6);
});

test('helpful errors with line numbers and suggestions', () => {
  throws('box a\nspehre b', /line 2: unknown command "spehre".*"sphere"/);
  throws('box ring\nanim rng rot.y spin', /anim: unknown target "rng".*"ring"/);
  throws('box a rott=1,2,3', /unknown option "rott".*"rot"/);
  throws('box a #12', /bad color/);
  throws('box a\nbox a', /duplicate name/);
  throws('use nope', /no object named "nope"/);
  throws('mat m #fff\nbox a m\nanim a glow wave 1 1s', /use a material name/);
});

test('standalone html exposes the scene', () => {
  const html = toHTML('scene bg=none dur=3s\nbox a');
  assert.match(html, /importmap/);
  assert.match(html, /window\.tinythree = mount/);
  assert.match(html, /background:transparent/);
  assert.equal(parse('scene dur=3s').scene.dur, 3);
});

test('radial copies sit on a circle and face outward', () => {
  const b = build('box r @0,1,0 radial=4,2');
  const c = b.objects.r.children;
  assert.equal(c.length, 4);
  assert.ok(Math.abs(c[1].position.z - 2) < 1e-6 && Math.abs(c[1].position.x) < 1e-6);
  assert.ok(Math.abs(c[1].rotation.y + Math.PI / 2) < 1e-6);
  assert.ok(c.every((m) => Math.abs(Math.hypot(m.position.x, m.position.z) - 2) < 1e-6));
});

test('torus arc makes a partial ring', () => {
  const b = build('torus t 1,.1 arc=180');
  assert.ok(Math.abs(b.objects.t.geometry.parameters.arc - Math.PI) < 1e-6);
});

test('truss builds an instanced lattice and mirrored copies lean inward', () => {
  const b = build('mat s #888\ntruss leg 2,1,4 @3,0,3 lean=-1,-1 n=4 s mirror=xz');
  const legs = b.objects.leg.children;
  assert.equal(legs.length, 4);
  assert.ok(legs[0].isInstancedMesh);
  assert.equal(legs[0].count, 4 * 4 * 4 + 4); // 4 bays × 4 faces × 4 beams + bottom ring
  for (const leg of legs) {
    leg.updateMatrixWorld(true);
    // the top centre must be closer to the axis than the base centre
    const m = new THREE.Matrix4();
    let topC = new THREE.Vector3(), botC = new THREE.Vector3(), nt = 0, nb = 0;
    for (let i = 0; i < leg.count; i++) {
      leg.getMatrixAt(i, m); const p = new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(leg.matrixWorld);
      if (p.y > 3.4) { topC.add(p); nt++; } else if (p.y < 0.6) { botC.add(p); nb++; }
    }
    topC.divideScalar(nt); botC.divideScalar(nb);
    assert.ok(Math.hypot(topC.x, topC.z) < Math.hypot(botC.x, botC.z), 'leans inward');
  }
});

test('truss picks bays from its size by default', () => {
  const b = build('truss t 2,2,6');
  assert.equal(b.objects.t.count, 5 * 4 * 4 + 4);
});

test('orthographic camera', () => {
  const b = build('scene ortho=8 size=1600,800');
  assert.ok(b.camera.isOrthographicCamera);
  assert.equal(b.camera.top, 4);
  assert.equal(b.camera.right, 8);
});

test('renderer block gets the renderer and can replace drawing', () => {
  const b = build('box a\nrenderer\n  renderer.flag = 1\n  draw(() => 42)\n  onResize((w, h) => w + h)');
  const fake = {}, H = {};
  b.host(fake, H);
  assert.equal(fake.flag, 1);
  assert.equal(H.draw(), 42);
  assert.equal(H.resize(2, 3), 5);
});

test('wait() makes ready() wait for async work', async () => {
  const b = build('js\n  wait(new Promise((r) => setTimeout(() => { O.late = 1; r(); }, 20)))');
  assert.equal(b.objects.late, undefined);
  await b.ready();
  assert.equal(b.objects.late, 1);
});

test('text labels are sprites; quoted labels keep their spaces', () => {
  const b = build('text title "Hello big world" #ff0000 @0,2,0 s=.5 top');
  assert.ok(b.objects.title.isSprite);
  assert.equal(b.objects.title.position.y, 2);
  assert.match(compile('text "a  b"'), /label\("a  b"/);
  assert.throws(() => compile('text t hello'), /quoted label/);
});

test('models load through GLTFLoader, keep URLs intact, and never break ready()', async () => {
  const code = compile('model chair https://example.com/chair.glb @1,0,2 ry=90 play');
  assert.match(code, /GLTFLoader/);
  assert.match(code, /"https:\/\/example\.com\/chair\.glb"/);
  assert.match(code, /mx\.setTime\(t\)/);
  const b = build('model chair missing.glb @1,0,2');
  assert.ok(b.objects.chair.isGroup);
  await b.ready(); // a failed load is reported, not thrown
});

test('materials take image or procedural textures', () => {
  const b = build('mat floor map=tiles rep=8,8\nmat wall #ccc map=brick.jpg\nbox a floor\nbox c wall');
  assert.equal(b.materials.floor.color.getHex(), 0xffffff); // untinted
  assert.equal(b.materials.wall.color.getHex(), 0xcccccc);
  assert.match(compile('mat w map=brick.jpg rep=4,2\nbox a w'), /TextureLoader/);
  assert.throws(() => compile('mat w map=brik'), /unknown texture "brik".*"brick"/);
});

test('library parts are cloned like templates', () => {
  const b = build('use lib:tree t1 @3,0,0\nuse lib:tree t2 @-3,0,0\nuse lib:car c');
  assert.ok(b.objects['lib:tree'].visible === false && b.objects.t1.visible && b.objects.t2.visible);
  assert.equal(b.objects.t1.position.x, 3);
  assert.equal(b.objects.t1.children.length, 2);
  assert.ok(b.materials.libglass.transparent);
  assert.throws(() => compile('use lib:tre'), /no library part "tre".*"tree"/);
});

test('every library part compiles', async () => {
  const { LIB } = await import('../src/tinythree.js');
  const b = build(Object.keys(LIB).map((k, i) => `use lib:${k} p${i} @${i * 3},0,0`).join('\n'));
  assert.equal(Object.keys(LIB).length, 13);
  for (let i = 0; i < 13; i++) assert.ok(b.objects['p' + i].children.length > 0);
});
