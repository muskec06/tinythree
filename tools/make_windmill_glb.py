"""Writes examples/assets/windmill.glb: a small animated test model (tower + spinning blades), no dependencies."""
import json, math, os, struct

def box(sx, sy, sz, ox=0, oy=0, oz=0, rz=0):
    """24-vertex box, rotated by rz (radians) around Z, then offset."""
    P, N, I = [], [], []
    faces = [((1,0,0),(0,1,0),(0,0,1)), ((-1,0,0),(0,1,0),(0,0,-1)), ((0,1,0),(0,0,1),(1,0,0)),
             ((0,-1,0),(0,0,-1),(1,0,0)), ((0,0,1),(1,0,0),(0,1,0)), ((0,0,-1),(-1,0,0),(0,1,0))]
    c, s = math.cos(rz), math.sin(rz)
    rot = lambda v: (v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2])
    for n, u, v in faces:
        base = len(P)
        for a, b in ((-1,-1), (1,-1), (1,1), (-1,1)):
            p = [ (n[k] + a*u[k] + b*v[k]) * (sx, sy, sz)[k] / 2 for k in range(3)]
            p = rot(p); P.append((p[0]+ox, p[1]+oy, p[2]+oz)); N.append(rot(n))
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        order = (0,1,2,0,2,3) if sum(cross[k]*n[k] for k in range(3)) > 0 else (0,2,1,0,3,2)
        I += [base + i for i in order]
    return P, N, I

def merge(parts):
    P, N, I = [], [], []
    for p, n, i in parts:
        I += [len(P) + k for k in i]; P += p; N += n
    return P, N, I

tower = merge([box(1.2, 4, 1.2, 0, 2, 0), box(1.6, .3, 1.6, 0, 4.1, 0)])
blades = merge([box(.35, 2.6, .08, -1.3*math.sin(a), 1.3*math.cos(a), 0, a) for a in [0, math.pi/2, math.pi, 3*math.pi/2]] + [box(.3, .3, .3)])

buf = bytearray(); views = []; accessors = []
def add(data, fmt, count, target, typ, comp, minmax=None):
    while len(buf) % 4: buf.append(0)
    off = len(buf); buf.extend(struct.pack('<' + fmt * count, *data) if fmt else data)
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf) - off, **({'target': target} if target else {})})
    acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': count // {'VEC3': 3, 'VEC4': 4, 'SCALAR': 1}[typ] if fmt else count, 'type': typ}
    if minmax: acc['min'], acc['max'] = minmax
    accessors.append(acc); return len(accessors) - 1

meshes = []
for name, (P, N, I), mat in (('tower', tower, 0), ('blades', blades, 1)):
    flat = [x for p in P for x in p]
    mn = [min(p[k] for p in P) for k in range(3)]; mx = [max(p[k] for p in P) for k in range(3)]
    pa = add(flat, 'f', len(flat), 34962, 'VEC3', 5126, (mn, mx))
    na = add([x for n in N for x in n], 'f', len(flat), 34962, 'VEC3', 5126)
    ia = add(I, 'H', len(I), 34963, 'SCALAR', 5123)
    meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': pa, 'NORMAL': na}, 'indices': ia, 'material': mat}]})

times = [0, 1, 2, 3, 4]
quats = []
for t in times:
    a = -t / 4 * 2 * math.pi
    quats += [0, 0, math.sin(a / 2), math.cos(a / 2)]
ta = add(times, 'f', len(times), None, 'SCALAR', 5126, ([0], [4]))
qa = add(quats, 'f', len(quats), None, 'VEC4', 5126)

gltf = {
    'asset': {'version': '2.0', 'generator': 'tinythree make_windmill_glb.py'},
    'scene': 0, 'scenes': [{'nodes': [0]}],
    'nodes': [{'name': 'windmill', 'children': [1, 2]}, {'name': 'tower', 'mesh': 0},
              {'name': 'blades', 'mesh': 1, 'translation': [0, 3.6, .75]}],
    'meshes': meshes,
    'materials': [{'name': 'white', 'pbrMetallicRoughness': {'baseColorFactor': [.93, .92, .88, 1], 'metallicFactor': 0, 'roughnessFactor': .8}},
                  {'name': 'red', 'pbrMetallicRoughness': {'baseColorFactor': [.75, .16, .12, 1], 'metallicFactor': 0, 'roughnessFactor': .6}}],
    'animations': [{'name': 'spin', 'samplers': [{'input': ta, 'output': qa, 'interpolation': 'LINEAR'}],
                    'channels': [{'sampler': 0, 'target': {'node': 2, 'path': 'rotation'}}]}],
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': len(buf)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4); buf += b'\0' * (-len(buf) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + bytes(buf)
path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'examples', 'assets', 'windmill.glb')
open(path, 'wb').write(out)
print('wrote', path, len(out), 'bytes')
