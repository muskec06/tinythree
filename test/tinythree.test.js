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
