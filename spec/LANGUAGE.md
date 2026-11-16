# tinythree language reference — v0.2

tinythree (`.t3`) describes a Three.js scene in as few tokens as possible while staying
readable to people. The compiler (`src/tinythree.js`) turns it into plain Three.js code.

> The short version that is given to AI models lives in [`ai/SYSTEM_PROMPT.md`](../ai/SYSTEM_PROMPT.md).
> This file explains the same rules in more detail.

## 1. Lines and tokens

- One command per line. Blank lines are ignored. `//` starts a comment.
- Indentation (spaces; a tab counts as 2) nests objects inside the `group` above.
- Tokens are separated by whitespace and come in five shapes:

| shape | meaning | example |
|---|---|---|
| `@x,y,z` | position | `@0,1.5,0` |
| `#rgb` / `#rrggbb` | color | `#0af`, `#8b5a2b` |
| `key=value` | option | `rot=0,45,0`, `r=.7` |
| `1,2,3` | size (first numeric list) | `2,.1,1` |
| `word` | flag, material, or the object's name | `floor`, `wood`, `table` |

Units are meters, degrees and seconds (`2s`, `500ms`, or a bare number). Y is up.

## 2. `scene`

Usually the first line. All options are optional.

| option | default | |
|---|---|---|
| `bg=#color` / `bg=none` | `#101418` | `none` makes the canvas transparent (for video overlays) |
| `cam=x,y,z` | `4,3,6` | camera position |
| `look=x,y,z` | `0,0,0` | camera target (also the orbit center) |
| `fov=deg` | `50` | |
| `fog=#color,near,far` | off | |
| `dur=8s` | `0` | length used by the video renderer |
| `size=w,h` | `1280,720` | render size for video |
| flags `orbit` `shadows` `grid` `axes` | off | mouse orbit, shadow maps, ground grid, axes helper |

## 3. Lights

```
amb   [intensity] [#color]
hemi  #sky #ground [intensity]
sun   x,y,z [intensity] [#color] [area=10]     // directional; casts shadows when `shadows` is on
point #color [intensity] [distance] @x,y,z
```

Lights can be indented inside a group; they then move with it.

## 4. Materials

```
mat name #color [r=roughness] [m=metalness] [glow=intensity] [glowc=#color] [op=opacity] [wire] [flat] [double]
```

Materials are `MeshStandardMaterial`s and must be defined before they are used.
An object can also take an inline color (`#f80`) instead of a material name.

## 5. Objects

```
type [name] [size] [material | #color] [@position] [options...] [flags...]
```

| type | size | Three.js |
|---|---|---|
| `box` | `w,h,d` (one value = cube) | BoxGeometry |
| `sphere` | `r` | SphereGeometry |
| `cyl` | `r,h` or `rTop,rBottom,h` | CylinderGeometry |
| `cone` | `r,h` | ConeGeometry |
| `torus` | `R,tube` (+ `arc=deg` for a partial ring) | TorusGeometry |
| `plane` | `w,h` | PlaneGeometry |
| `capsule` | `r,length` | CapsuleGeometry |
| `lathe` | `pts=r,y;r,y;...` | LatheGeometry |
| `extrude` | `pts=x,y;x,y;...` + `d=depth` | ExtrudeGeometry |
| `arrow` | `dx,dy,dz,length` | ArrowHelper |
| `group` | — | Group (children are indented) |
| `use src [name]` | — | `.clone()` of an earlier named object |

**Name.** The first plain word after the type is the name, unless it is a material or a flag.
Names are optional, unique, and only needed for `anim` and `use`.

**Options.** `rot=x,y,z` (degrees) or `rx=`/`ry=`/`rz=` · `s=k` or `s=x,y,z` · `seg=n` (curve detail; `seg=4` turns a cone or cylinder into a square pyramid or tapered tower) · `arc=deg` (torus only) · `name=...`

**Flags.** `floor` (rotate a plane to lie on the ground; receives shadows) · `noshadow` · `hidden`.
A `hidden` object is a template: `use` clones of it are visible.

**Copies.** These expand one line into many. The object's name then refers to a group that holds all copies.

| option | result |
|---|---|
| `mirror=x` / `z` / `xz` / `xyz` | adds copies with the position mirrored across those axes (`xz` → 4 copies) |
| `array=n,dx,dy,dz` | `n` copies, each shifted by `dx,dy,dz` |
| `grid=nx,nz,dx,dz` | `nx × nz` copies on the ground plane |
| `radial=n,r` | `n` copies on a circle of radius `r` around the position (XZ plane); each copy is turned so its local +x points outward — columns, stone circles, spokes, pods |

## 6. Animation

```
anim target property kind args...
```

- **target** — an object or group name, a material name, or `cam`.
- **property** — `pos.x pos.y pos.z rot.x rot.y rot.z s` for objects; `glow op` for materials.
- **kind**
  - `spin period` — one full turn per period (negative period = reverse). Rotation only.
  - `wave amplitude period` — adds `amplitude · sin(2πt / period)` to the base value.
  - `to value duration [at=start] [ease=io|in|out|lin]` — tween from the previous value. Several `to` on the same property play one after another, ordered by `at`.
- `anim cam orbit period` — the camera circles `look` at its starting radius and height.

`to`, `spin` and `wave` can be combined on one property: tweens set the base value and `spin`/`wave` add on top.
When the user drags the view, camera animations stop so they don't fight the mouse.

## 7. Escape hatch

Anything the language can't express can be written in plain Three.js:

```
js
  const light = new THREE.SpotLight(0xffffff, 50); light.position.set(0, 5, 0); scene.add(light);
tick
  O.ring.material.color.setHSL((t * .1) % 1, 1, .5);
```

`js` runs once after the scene is built; `tick` runs every frame with `t` in seconds.
Available names: `THREE`, `scene`, `camera`, `O` (objects by name), `M` (materials by name), `t` (tick only).

## 8. What the compiler produces

`compile(src)` returns an ES module:

```js
export default function build(THREE) {
  // ... plain Three.js ...
  return { scene, camera, update(t), objects, materials, opts };
}
```

`update(t)` is a pure function of time, which makes frame-exact video rendering possible.
`mount(THREE, built, element)` adds a renderer, orbit controls and a render loop, and
`toHTML(src)` produces a standalone page that exposes `window.tinythree.seek(t)`.

## 9. Errors

Errors name the line and, when possible, suggest a fix, for example:

```
line 7: unknown command "spehre" (did you mean "sphere"?)
line 12: anim: unknown target "rng" (did you mean "ring"?)
```

These messages are short on purpose: they can be fed straight back to an AI model, which then fixes only that line.
