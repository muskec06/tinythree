#!/usr/bin/env python3
"""Render a tinythree scene to MP4 / MOV / WebM / PNG, frame-exact (headless Chrome + ffmpeg).

    python tools/render.py examples/atom.t3 -o atom.mp4
    python tools/render.py examples/atom.t3 -o atom.mp4 --fps 60 --dur 4 --size 1920,1080
    python tools/render.py examples/atom.t3 -o thumb.png --still 1.5
    python tools/render.py overlay.t3 -o overlay.mov          # scene bg=none -> ProRes 4444 with alpha

Every frame is produced by seeking the scene to an exact time (t = i / fps), so the
result does not depend on how fast your machine is. Needs: node, ffmpeg, and
`pip install playwright && playwright install chromium` (or a local Chrome).
"""
import argparse
import functools
import http.server
import os
import shutil
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build_html(scene, three_url):
    if scene.endswith('.html'):
        return open(scene, encoding='utf-8').read()
    cmd = ['node', os.path.join(ROOT, 'bin', 'tinythree.js'), 'build', scene]
    if three_url:
        cmd += ['--three', three_url]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr.strip())
    return r.stdout


def serve(directory):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    handler.log_message = lambda *a, **k: None
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def launch(p):
    args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    try:
        return p.chromium.launch(args=args)
    except Exception:
        for path in ('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
                     r'C:\Program Files\Google\Chrome\Application\chrome.exe'):
            if os.path.exists(path):
                return p.chromium.launch(executable_path=path, args=args)
        raise


def ffmpeg_cmd(out, fps, alpha):
    base = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-i', '-']
    ext = os.path.splitext(out)[1].lower()
    if ext == '.mov':
        enc = ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le' if alpha else 'yuv422p10le']
    elif ext == '.webm':
        enc = ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-pix_fmt', 'yuva420p' if alpha else 'yuv420p']
    else:
        enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    return base + enc + [out]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('scene', help='.t3 source or a built .html')
    ap.add_argument('-o', '--out', required=True, help='.mp4 / .mov / .webm / .png')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--dur', type=float, help='seconds (default: scene dur=, else 5)')
    ap.add_argument('--size', help='W,H (default: scene size=, else 1280,720)')
    ap.add_argument('--still', type=float, help='render a single frame at this time (use with .png)')
    ap.add_argument('--three', help='three.js base URL (default: jsdelivr CDN)')
    ap.add_argument('--three-dir', help='serve three.js from a local folder (e.g. node_modules/three)')
    a = ap.parse_args()

    from playwright.sync_api import sync_playwright

    work = tempfile.mkdtemp(prefix='tinythree-')
    try:
        three_url = a.three
        if a.three_dir:
            os.symlink(os.path.abspath(a.three_dir), os.path.join(work, 'three'))
            three_url = '/three/'
        with open(os.path.join(work, 'index.html'), 'w', encoding='utf-8') as fh:
            fh.write(build_html(a.scene, three_url))
        httpd = serve(work)
        url = f'http://127.0.0.1:{httpd.server_address[1]}/index.html?render'

        with sync_playwright() as p:
            browser = launch(p)
            page = browser.new_page(viewport={'width': 1280, 'height': 720})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(url)
            try:
                page.wait_for_function('window.tinythree && window.tinythree.ready', timeout=30000)
            except Exception:
                sys.exit('scene failed to load: ' + '; '.join(errors or ['timeout (is three.js reachable?)']))
            info = page.evaluate('({dur: tinythree.duration, size: tinythree.size, alpha: !!tinythree.renderer.getContextAttributes().alpha})')
            w, h = map(int, a.size.split(',')) if a.size else info['size']
            page.set_viewport_size({'width': w, 'height': h})
            page.evaluate(f'tinythree.resize({w}, {h}); tinythree.renderer.setPixelRatio(1); tinythree.resize({w}, {h})')
            canvas = page.locator('canvas')
            alpha = info['alpha']

            if a.still is not None or a.out.lower().endswith('.png'):
                page.evaluate(f'tinythree.seek({a.still or 0})')
                canvas.screenshot(path=a.out, omit_background=alpha)
            else:
                dur = a.dur or info['dur'] or 5
                frames = int(round(dur * a.fps))
                proc = subprocess.Popen(ffmpeg_cmd(a.out, a.fps, alpha), stdin=subprocess.PIPE)
                for i in range(frames):
                    page.evaluate(f'tinythree.seek({i / a.fps})')
                    proc.stdin.write(canvas.screenshot(omit_background=alpha))
                    if i % a.fps == 0:
                        print(f'\r{i}/{frames} frames', end='', file=sys.stderr, flush=True)
                proc.stdin.close()
                if proc.wait():
                    sys.exit('ffmpeg failed')
                print(f'\r{frames}/{frames} frames', file=sys.stderr)
            browser.close()
        httpd.shutdown()
        print(f'wrote {a.out}', file=sys.stderr)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
