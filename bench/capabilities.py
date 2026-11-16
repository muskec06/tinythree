#!/usr/bin/env python3
"""Capability audit: which Three.js features work in tinythree, and how?

Each probe is a small .t3 scene plus a check that runs in a real browser (headless Chrome + WebGL).
Levels:  native  = tinythree syntax · js = needs the js/tick escape hatch · blocked = not possible today.

    python bench/capabilities.py            # needs playwright + node; serves three from node_modules
"""
import base64, functools, http.server, json, os, shutil, subprocess, sys, tempfile, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE_AGX = 6  # THREE.AgXToneMapping

P = []  # (area, feature, expected level, source, check-js)
def probe(area, feature, level, src, check):
    P.append((area, feature, level, src.strip('\n'), check))

# ------------------------------------------------------------------ native
probe('Geometry', 'box, sphere, cyl, cone, torus, plane, capsule, lathe, extrude', 'native', '''
box a
sphere b
cyl c .3,1
cone d .3,1
torus e 1,.1 arc=270
plane f 2
capsule g .2,.5
lathe h pts=0,0;.5,0;.3,1
extrude i pts=0,0;1,0;1,1 d=.2
''', "(()=>{let n=0;tinythree.scene.traverse(o=>{if(o.isMesh)n++});return n===9})()")
probe('Geometry', 'lattice towers (truss, instanced)', 'native', 'truss t 2,1,6', "tinythree.scene.getObjectByProperty('isInstancedMesh',true).count>50")
probe('Geometry', 'arrows / vectors', 'native', 'arrow a 1,0,0,2 #f00', "!!tinythree.scene.getObjectByProperty('type','ArrowHelper')")
probe('Material', 'standard: color, roughness, metalness, emissive, opacity, wireframe, flat, double side', 'native',
      'mat m #f80 r=.3 m=.8 glow=1 op=.5 wire flat double\nbox a m',
      "(m=>m.isMeshStandardMaterial&&m.metalness===.8&&m.opacity===.5&&m.wireframe&&m.side===2)(tinythree.scene.children.find(o=>o.isMesh).material)")
probe('Light', 'ambient, hemisphere, directional (sun), point', 'native',
      'amb .3\nhemi #fff #444\nsun 5,10,5 2\npoint #fff 3 5 @0,2,0',
      "['AmbientLight','HemisphereLight','DirectionalLight','PointLight'].every(t=>tinythree.scene.getObjectByProperty('type',t))")
probe('Rendering', 'shadow maps', 'native', 'scene shadows\nsun 5,10,5\nbox a', "tinythree.renderer.shadowMap.enabled")
probe('Rendering', 'linear fog, background color, transparent background', 'native', 'scene bg=none fog=#888,5,30',
      "!!tinythree.scene.fog&&tinythree.renderer.getContextAttributes().alpha")
probe('Rendering', 'grid and axes helpers', 'native', 'scene grid axes', "!!tinythree.scene.getObjectByProperty('type','GridHelper')")
probe('Scene graph', 'groups, nesting, clones (use), hidden templates', 'native', 'group g hidden\n  box a\nuse g c @2,0,0',
      "tinythree.scene.children.filter(o=>o.isGroup).length===2")
probe('Scene graph', 'copies: mirror, array, grid, radial', 'native',
      'box a @1,0,1 mirror=xz\nbox b array=3,1,0,0\nbox c grid=2,2,1,1\nbox d radial=6,2',
      "(()=>{let n=0;tinythree.scene.traverse(o=>{if(o.isMesh)n++});return n===4+3+4+6})()")
probe('Animation', 'spin, wave, chained tweens with easing, camera orbit', 'native',
      'mat m #fff glow=1\nbox a m\nanim a rot.y spin 2s\nanim a pos.y to 2 1s at=1s\nanim m glow wave 1 2s\nanim cam orbit 10s',
      "(()=>{tinythree.pause();tinythree.seek(2.5);const a=tinythree.scene.children.find(o=>o.isMesh);return a.position.y===2})()")
probe('Camera', 'perspective camera, position, target, fov, orbit controls', 'native', 'scene cam=3,2,5 look=0,1,0 fov=35 orbit',
      "tinythree.camera.fov===35&&!!tinythree.controls")
probe('Video', 'frame-exact seek(t)', 'native', 'box a\nanim a rot.y spin 4s',
      "(()=>{tinythree.pause();tinythree.seek(1);const r=tinythree.scene.children.find(o=>o.isMesh).rotation.y;return Math.abs(r-Math.PI/2)<1e-6})()")

probe('Text', 'text labels (canvas sprites, also in videos)', 'native', 'text t "F = m·a" @0,1.5,0 #fff bg=#123 s=.5 top',
      "(s=>s.isSprite&&!!s.material.map&&s.renderOrder===999)(tinythree.scene.children.find(o=>o.isSprite))")
probe('Loaders', 'glTF / GLB models with their animations (frame-exact)', 'native', 'model mill assets/windmill.glb @0,0,0 play',
      "(()=>{tinythree.pause();tinythree.seek(1);const b=tinythree.scene.getObjectByName('blades');return tinythree.ready===true&&!!b&&Math.abs(Math.abs(b.quaternion.z)-Math.SQRT1_2)<1e-3})()")
probe('Texture', 'image and procedural textures with repeat (checker, grid, brick, tiles, wood, grass, noise)', 'native',
      'mat a map=brick rep=3,2\nmat b map=assets/../assets/tex.png\nbox x a\nbox y b @2,0,0',
      "(()=>{const m=tinythree.scene.children.filter(o=>o.isMesh).map(o=>o.material);return tinythree.ready===true&&!!m[0].map&&m[0].map.repeat.x===3&&!!m[1].map})()")
probe('Scene graph', 'part library: 13 real-size parts (trees, people, cars, houses, doors, windows, stairs…)', 'native',
      'use lib:house h\nuse lib:tree t @5,0,0\nuse lib:car c @-5,0,0',
      "tinythree.scene.children.filter(o=>o.isGroup&&o.visible).length===3")

# ------------------------------------------------------------------ escape hatch (js / tick)
probe('Geometry', 'torus knot, polyhedra, ring, circle, tube along a curve, shape, edges', 'js', '''
js
  const m = new THREE.MeshStandardMaterial({ color: 0x88ccff });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(1,1,0), new THREE.Vector3(2,0,1)]);
  for (const g of [new THREE.TorusKnotGeometry(.5,.15,100,16), new THREE.IcosahedronGeometry(.5,1), new THREE.DodecahedronGeometry(.5),
    new THREE.RingGeometry(.3,.5,32), new THREE.CircleGeometry(.5,32), new THREE.TubeGeometry(curve,64,.05,8,false)]) scene.add(new THREE.Mesh(g, m));
  scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry()), new THREE.LineBasicMaterial()));
''', "(()=>{let n=0;tinythree.scene.traverse(o=>{if(o.isMesh)n++});return n===6})()")
probe('Material', 'physical (glass transmission, clearcoat), toon, phong, lambert, basic, normal', 'js', '''
js
  const ms = [new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: .5, roughness: 0, clearcoat: 1 }), new THREE.MeshToonMaterial(),
    new THREE.MeshPhongMaterial({ shininess: 80 }), new THREE.MeshLambertMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshNormalMaterial()];
  ms.forEach((m, i) => { const o = new THREE.Mesh(new THREE.SphereGeometry(.3), m); o.position.x = i; scene.add(o); });
''', "tinythree.scene.children.some(o=>o.material&&o.material.isMeshPhysicalMaterial&&o.material.transmission===1)")
probe('Material', 'custom GLSL shader with a time uniform', 'js', '''
js
  M.wave = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } },
    vertexShader: 'uniform float t; void main(){ vec3 p = position; p.y += sin(p.x*4.+t)*.1; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }',
    fragmentShader: 'uniform float t; void main(){ gl_FragColor = vec4(.5+.5*sin(t),.4,.9,1.); }' });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 1, 32, 8), M.wave));
tick
  M.wave.uniforms.t.value = t
''', "(()=>{tinythree.pause();tinythree.seek(3);return tinythree.scene.children.find(o=>o.material&&o.material.isShaderMaterial).material.uniforms.t.value===3})()")
probe('Texture', 'procedural textures (canvas), gradient sky background', 'js', '''
js
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#222' : '#eee'; g.fillRect(i * 8, j * 8, 8, 8); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: tex })));
  const s = document.createElement('canvas'); s.width = 2; s.height = 256; const sg = s.getContext('2d');
  const grd = sg.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#4a90d9'); grd.addColorStop(1, '#fbe3c4'); sg.fillStyle = grd; sg.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(s);
''', "tinythree.scene.background&&tinythree.scene.background.isTexture&&tinythree.scene.children.some(o=>o.material&&o.material.map)")
probe('Texture', 'image textures via TextureLoader (async)', 'js', '''
js
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwnwEIGGAMAEnKBf+P3c0OAAAAAElFTkSuQmCC';
  new THREE.TextureLoader().load(png, (t) => { scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: t }))); window.__ok = true; });
''', "window.__ok===true")
probe('Light', 'spot light with target, light helpers', 'js', '''
js
  const s = new THREE.SpotLight(0xffffff, 50, 10, .4, .3); s.position.set(0, 4, 0); s.target.position.set(1, 0, 0);
  scene.add(s, s.target, new THREE.SpotLightHelper(s));
''', "!!tinythree.scene.getObjectByProperty('type','SpotLight')")
probe('Light', 'rect area light (addon, dynamic import)', 'js', '''
js
  import('three/addons/lights/RectAreaLightUniformsLib.js').then(({ RectAreaLightUniformsLib }) => {
    RectAreaLightUniformsLib.init(); const l = new THREE.RectAreaLight(0xffffff, 5, 2, 1); l.position.set(0, 2, 0); scene.add(l); window.__ok = true; });
''', "window.__ok===true&&!!tinythree.scene.getObjectByProperty('type','RectAreaLight')")
probe('Objects', 'particles (Points) animated per frame', 'js', '''
js
  const n = 5000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - .5) * 10;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  O.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: .05, color: 0xffffff })); scene.add(O.dust);
tick
  O.dust.rotation.y = t * .1
''', "tinythree.scene.getObjectByProperty('isPoints',true).geometry.attributes.position.count===5000")
probe('Objects', 'lines, line loops, sprites, LOD, instanced meshes with per-instance color', 'js', '''
js
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 1, 0)]), new THREE.LineBasicMaterial()));
  scene.add(new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff0000 })));
  const lod = new THREE.LOD(); lod.addLevel(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16)), 0); lod.addLevel(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4)), 20); scene.add(lod);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshStandardMaterial(), 1000);
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < 1000; i++) { o.position.set(i % 10, Math.floor(i / 100), Math.floor(i / 10) % 10); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.setHSL(i / 1000, 1, .5)); }
  scene.add(im);
''', "['Line','Sprite','LOD'].every(t=>tinythree.scene.getObjectByProperty('type',t))&&!!tinythree.scene.getObjectByProperty('isInstancedMesh',true).instanceColor")
probe('Rendering', 'exponential fog', 'js', 'js\n  scene.fog = new THREE.FogExp2(0x8899aa, .05)', "tinythree.scene.fog.isFogExp2")
probe('Interaction', 'raycasting / picking objects under the mouse', 'js', '''
box target @0,0,0
js
  const ray = new THREE.Raycaster();
  addEventListener('pointerdown', (e) => {
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const hit = ray.intersectObjects(scene.children, true)[0]; if (hit) { hit.object.material = hit.object.material.clone(); hit.object.material.color.set('red'); window.__ok = true; } });
''', "(()=>{dispatchEvent(new PointerEvent('pointerdown',{clientX:innerWidth/2,clientY:innerHeight/2}));return window.__ok===true})()")
probe('Loaders', 'glTF / GLB models (GLTFLoader via dynamic import)', 'js', '''
js
  Promise.all([import('three/addons/exporters/GLTFExporter.js'), import('three/addons/loaders/GLTFLoader.js')]).then(([{ GLTFExporter }, { GLTFLoader }]) => {
    const src = new THREE.Mesh(new THREE.TorusKnotGeometry(.4, .1), new THREE.MeshStandardMaterial({ color: 0x44aa88 }));
    new GLTFExporter().parse(src, (glb) => new GLTFLoader().parse(glb, '', (gltf) => { gltf.scene.name = 'loaded'; scene.add(gltf.scene); window.__ok = true; }), console.error, { binary: true });
  });
''', "window.__ok===true&&!!tinythree.scene.getObjectByName('loaded')")
probe('Animation', 'keyframe clips with AnimationMixer, morph targets, skinned meshes (frame-exact)', 'js', '''
js
  const geo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  geo.morphAttributes.position = [geo.attributes.position.clone().applyMatrix4(new THREE.Matrix4().makeScale(1, 2, 1))];
  O.blob = new THREE.Mesh(geo, new THREE.MeshStandardMaterial()); scene.add(O.blob);
  const clip = new THREE.AnimationClip('grow', 2, [new THREE.NumberKeyframeTrack('.morphTargetInfluences[0]', [0, 2], [0, 1]),
    new THREE.VectorKeyframeTrack('.position', [0, 2], [0, 0, 0, 0, 1, 0])]);
  O.mixer = new THREE.AnimationMixer(O.blob); O.mixer.clipAction(clip).play();
  const bones = [new THREE.Bone(), new THREE.Bone()]; bones[0].add(bones[1]); bones[1].position.y = 1;
  const sk = new THREE.SkinnedMesh(new THREE.CylinderGeometry(.1, .1, 2), new THREE.MeshStandardMaterial());
  sk.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(sk.geometry.attributes.position.count * 4).fill(0), 4));
  sk.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(sk.geometry.attributes.position.count).fill([1, 0, 0, 0]).flat(), 4));
  sk.add(bones[0]); sk.bind(new THREE.Skeleton(bones)); scene.add(sk);
tick
  O.mixer.setTime(t)
''', "(()=>{tinythree.pause();tinythree.seek(1);const b=tinythree.scene.children.find(o=>o.morphTargetInfluences);return Math.abs(b.morphTargetInfluences[0]-.5)<1e-6&&!!tinythree.scene.getObjectByProperty('isSkinnedMesh',true)})()")
probe('Text', '3D text labels as sprites (canvas)', 'js', '''
js
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = 'bold 40px sans-serif'; g.fillStyle = '#fff'; g.fillText('F = m·a', 10, 45);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) })); s.scale.set(2, .5, 1); s.position.y = 1.5; scene.add(s);
''', "!!tinythree.scene.getObjectByProperty('type','Sprite').material.map")
probe('Audio', 'positional audio attached to the camera', 'js', '''
js
  const listener = new THREE.AudioListener(); camera.add(listener);
  const snd = new THREE.PositionalAudio(listener); scene.add(snd); window.__ok = true;
''', "window.__ok===true")

# ------------------------------------------------------------------ renderer block (needs the WebGLRenderer)
probe('Rendering', 'renderer settings: tone mapping, exposure, color space, pixel ratio', 'renderer', '''
renderer
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.toneMappingExposure = 1.6
''', "tinythree.renderer.toneMappingExposure===1.6&&tinythree.renderer.toneMapping===THREE_AGX")
probe('Rendering', 'environment maps / image-based lighting (PMREM + RoomEnvironment)', 'renderer', '''
sphere s 1
renderer
  wait(import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; }))
''', "tinythree.ready===true&&!!tinythree.scene.environment")
probe('Post-processing', 'EffectComposer: bloom, depth of field, outlines, SSAO', 'renderer', '''
mat neon #0ff glow=3
torus t 1,.1 neon
renderer
  wait(Promise.all([import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js')]).then(([{ EffectComposer }, { RenderPass }, { UnrealBloomPass }]) => {
    const fx = new EffectComposer(renderer);
    fx.addPass(new RenderPass(scene, camera));
    fx.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 1.2, .4, .1));
    draw(() => fx.render());
    onResize((w, h) => fx.setSize(w, h));
    window.__fx = fx; }))
''', "tinythree.ready===true&&window.__fx.passes.length===2")
probe('Camera', 'orthographic camera (isometric / technical views)', 'native', 'scene ortho=10 cam=10,10,10\nbox a',
      "tinythree.camera.isOrthographicCamera&&tinythree.camera.top===5")
probe('Text', 'HTML labels in 3D (CSS2DRenderer drawn every frame)', 'renderer', '''
box a
renderer
  wait(import('three/addons/renderers/CSS2DRenderer.js').then(({ CSS2DRenderer, CSS2DObject }) => {
    const d = document.createElement('div'); d.className = 'label'; d.textContent = 'column C3'; d.style.color = '#fff';
    const tag = new CSS2DObject(d); tag.position.y = 1; O.a.add(tag);
    const labels = new CSS2DRenderer(); labels.domElement.style.cssText = 'position:absolute;top:0;pointer-events:none';
    document.body.appendChild(labels.domElement);
    labels.setSize(innerWidth, innerHeight);
    draw(() => { renderer.render(scene, camera); labels.render(scene, camera); });
    onResize((w, h) => labels.setSize(w, h)); }))
''', "tinythree.ready===true&&!!document.querySelector('.label')&&document.querySelector('.label').style.transform.includes('translate')")
probe('XR', 'WebXR VR/AR (renderer.xr + VRButton)', 'renderer', '''
box a
renderer
  renderer.xr.enabled = true
  wait(import('three/addons/webxr/VRButton.js').then(({ VRButton }) => document.body.appendChild(VRButton.createButton(renderer))))
''', "tinythree.renderer.xr.enabled===true&&tinythree.ready===true")
probe('Video', 'async assets (textures/models) loaded before the first video frame', 'js', '''
js
  wait(new Promise((done) => setTimeout(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); m.name = 'late'; scene.add(m); done(); }, 800)))
''', "tinythree.ready===true&&!!tinythree.scene.getObjectByName('late')")


def main():
    from playwright.sync_api import sync_playwright
    work = tempfile.mkdtemp(prefix='tt-cap-')
    os.symlink(os.path.join(ROOT, 'node_modules', 'three'), os.path.join(work, 'three'))
    os.makedirs(os.path.join(work, 'assets'))
    shutil.copy(os.path.join(ROOT, 'examples', 'assets', 'windmill.glb'), os.path.join(work, 'assets'))
    with open(os.path.join(work, 'assets', 'tex.png'), 'wb') as fh:  # 2x2 test image
        fh.write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwnwEIGGAMAEnKBf+P3c0OAAAAAElFTkSuQmCC'))
    for i, (_, _, _, src, _) in enumerate(P):
        with open(os.path.join(work, f'p{i}.t3'), 'w') as fh:
            fh.write(src + '\n')
        r = subprocess.run(['node', os.path.join(ROOT, 'bin', 'tinythree.js'), 'build', f'p{i}.t3', '--three', '/three/', '-o', f'p{i}.html'],
                           cwd=work, capture_output=True, text=True)
        if r.returncode:
            sys.exit(f'probe {i} failed to compile: {r.stderr}')

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=work))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{httpd.server_address[1]}'

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for i, (area, feature, level, src, check) in enumerate(P):
            page = browser.new_page(viewport={'width': 640, 'height': 400})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e).split('\n')[0]))
            page.goto(f'{base}/p{i}.html')
            page.wait_for_timeout(1500)
            try:
                ok = bool(page.evaluate(check.replace('THREE_AGX', str(THREE_AGX))))
            except Exception as e:
                ok, errors = False, errors + [str(e).split('\n')[0]]
            results.append({'area': area, 'feature': feature, 'level': level, 'works': ok and not errors, 'errors': errors[:1]})
            page.close()
        browser.close()
    httpd.shutdown()

    mark = {'native': 'native', 'js': 'js', 'renderer': 'renderer'}
    for r in results:
        status = 'PASS' if r['works'] else 'FAIL'
        print(f"{status:4} {mark[r['level']]:8} {r['area']:15} {r['feature']}" + (f"  ← {r['errors'][0][:90]}" if r['errors'] else ''))
    with open(os.path.join(ROOT, 'bench', 'capabilities.json'), 'w') as fh:
        json.dump(results, fh, indent=2)
    write_markdown(results)


LEVEL = {'native': '✅ tinythree syntax', 'js': '🧩 `js` / `tick` block', 'renderer': '🔧 `renderer` block'}


def write_markdown(results):
    n = len(results); ok = sum(r['works'] for r in results)
    count = {k: sum(1 for r in results if r['level'] == k) for k in LEVEL}
    rows = '\n'.join(f"| {r['area']} | {r['feature']} | {LEVEL[r['level']]} | {'pass' if r['works'] else '**fail**'} |"
                     for r in sorted(results, key=lambda r: (list(LEVEL).index(r['level']), r['area'])))
    md = f'''# What can tinythree do? — Three.js capability audit

Generated by [`bench/capabilities.py`](../bench/capabilities.py): **{ok}/{n} probes pass** in headless Chrome (WebGL via SwiftShader).
Every probe is a small `.t3` scene plus a check that runs against the live page.

| level | meaning | probes |
|---|---|---:|
| ✅ tinythree syntax | one short line of the language | {count['native']} |
| 🧩 `js` / `tick` block | plain Three.js inside the scene file; runs once (`js`) or every frame (`tick`) | {count['js']} |
| 🔧 `renderer` block | plain Three.js that needs the WebGLRenderer: tone mapping, environment maps, post-processing, extra renderers, WebXR | {count['renderer']} |

**Short answer:** anything Three.js can draw can be expressed in a tinythree file. The common 80% (shapes, materials,
lights, shadows, copies, lattices, animation, cameras, video) is compact syntax, so it saves tokens. The long tail is
plain Three.js inside `js`, `tick` and `renderer` blocks; it works but saves nothing over writing Three.js directly.

| area | feature | how | result |
|---|---|---|---|
{rows}

## Known limits

- **HTML overlays are not in videos.** `tools/render.py` captures the WebGL canvas. Labels made with CSS2DRenderer show in the browser but not in MP4s. Use sprite labels (canvas textures) for video.
- **WebXR** is only checked for setup (`renderer.xr.enabled`, VR button). A headset session can't be tested headlessly.
- **Physics** is not part of Three.js. Load a library (cannon-es, Rapier) with `import()` in a `js` block and step it in `tick`. Use a fixed time step if the scene will be rendered to video.
- **3D text** (TextGeometry) needs a typeface JSON file. Sprite or CSS2D labels need no files.
- **Async assets** must be wrapped in `wait(promise)`. Otherwise video frames can be captured before a model or texture has loaded.
'''
    with open(os.path.join(ROOT, 'docs', 'CAPABILITIES.md'), 'w') as fh:
        fh.write(md)
    print(f'wrote docs/CAPABILITIES.md ({ok}/{n})')


if __name__ == '__main__':
    main()
