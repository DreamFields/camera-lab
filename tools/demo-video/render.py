"""Serve the real Camera Lab engine with a fixed-time video export driver."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from audio import write_audio

REPO = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).resolve().parent
PROFILES = {
    'portrait': (1080, 1440, '3x4', 'width:1080px;height:720px;top:340px;left:0'),
    'landscape': (1920, 1080, '16x9', 'width:1128px;height:752px;top:220px;left:64px'),
}


def prepare(work, aspect, frames):
    width, height, suffix, slot = PROFILES[aspect]
    work.mkdir(parents=True, exist_ok=True)
    (work / 'frames').mkdir(exist_ok=True)
    if any((work / 'frames').iterdir()):
        raise ValueError('Work directory already contains frames; choose a fresh --work-dir.')
    offline = (REPO / 'index-offline.html').read_text(encoding='utf-8')
    imports = re.search(r'<script type="importmap">[\s\S]*?</script>', offline).group()
    head = (REPO / 'src/a-head.html').read_text(encoding='utf-8')
    head = re.sub(r'<link[^>]+>', '', head)
    slot = slot.replace(';', '!important;') + '!important;position:absolute;'
    head = head.replace('</head>', imports + f'''<style>
.top,.side,.brand,.rollcard,.hint,#labels,#loading,.toast{{visibility:hidden!important}}
.big{{padding:0!important}}.bigslot{{{slot}}}
#renderStart{{position:fixed;z-index:100;top:20px;left:20px;background:white;color:black;padding:14px 24px}}
#renderStatus{{position:fixed;z-index:100;top:80px;left:20px;color:white;background:black;padding:12px}}
</style></head>''')
    body = (REPO / 'src/b-body.html').read_text(encoding='utf-8')
    sources = sorted((REPO / 'src/js').glob('*.js'))
    js = '\n'.join(path.read_text(encoding='utf-8') for path in sources)
    js = js.replace("'three'", "'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'")
    js = js.replace("'three/addons/", "'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/")
    js = js.replace('SW = 540, SH = 360', 'SW = 1080, SH = 720')
    driver = (TOOLS / f'{aspect}.js').read_text(encoding='utf-8')
    driver = driver.replace('i<900', f'i<{frames}').replace('total:900', f'total:{frames}')
    driver = driver.replace('frame:900', f'frame:{frames}')
    driver += "\n$('renderStart').disabled = false;\n"
    controls = f'<button id="renderStart" disabled>开始生成演示视频</button><div id="renderStatus">就绪 · {width} × {height} · 30 FPS</div>'
    page = head + body + controls + '<script type="module">' + js + '\n' + driver + '</script></body></html>'
    (work / 'render.html').write_text(page, encoding='utf-8')
    write_audio(work / 'ambience.wav', frames / 30)
    tracked_inputs = [REPO / 'src/a-head.html', REPO / 'src/b-body.html', *sources,
                      REPO / 'index-offline.html', TOOLS / f'{aspect}.js', TOOLS / 'audio.py', TOOLS / 'render.py']
    recipe = {'aspect': aspect, 'width': width, 'height': height, 'fps': 30, 'frames': frames,
              'source_sha256': {p.relative_to(REPO).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                                for p in tracked_inputs}}
    (work / 'recipe.json').write_text(json.dumps(recipe, indent=2), encoding='utf-8')


def encode(work, output, aspect, frames):
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('ffmpeg must be installed and available on PATH.')
    missing = [i for i in range(frames) if not (work / 'frames' / f'{i:04d}.jpg').exists()]
    if missing:
        raise ValueError(f'Missing frames: {missing[:10]}')
    output.parent.mkdir(parents=True, exist_ok=True)
    filters = ['-vf', 'setsar=1'] if aspect == 'portrait' else [
        '-vf', 'scale=in_range=pc:out_range=tv,setsar=1', '-color_range', 'tv']
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'warning',
                    '-framerate', '30', '-i', str(work / 'frames/%04d.jpg'),
                    '-i', str(work / 'ambience.wav'), '-frames:v', str(frames),
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
                    *filters, '-c:a', 'aac', '-b:a', '192k', '-af', 'volume=1.5',
                    '-t', str(frames / 30), '-movflags', '+faststart', str(output)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--aspect', choices=PROFILES, required=True)
    parser.add_argument('--port', type=int, default=8770)
    parser.add_argument('--work-dir', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--frames', type=int, default=900, help='Use 3 for a quick pipeline check.')
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--encode-only', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.frames <= 900:
        parser.error('--frames must be between 1 and 900.')
    work = (args.work_dir or REPO / '.demo-video-work' / args.aspect).resolve()
    output = (args.output or REPO / 'media/demo' / f'camera-lab-demo-{PROFILES[args.aspect][2]}.mp4').resolve()
    if args.encode_only:
        encode(work, output, args.aspect, args.frames)
        return
    if not args.prepare_only and not shutil.which('ffmpeg'):
        parser.error('ffmpeg must be installed and available on PATH.')
    prepare(work, args.aspect, args.frames)
    if args.prepare_only:
        print(f'Prepared: {work / "render.html"}')
        return

    encode_started = threading.Event()

    def finish():
        try:
            encode(work, output, args.aspect, args.frames)
            result = {'state': 'encoded', 'output': str(output)}
        except Exception as error:
            result = {'state': 'error', 'message': str(error)}
        (work / 'result.json').write_text(json.dumps(result), encoding='utf-8')
        print(json.dumps(result), flush=True)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *handler_args, **kwargs):
            super().__init__(*handler_args, directory=str(work), **kwargs)

        def log_message(self, *_):
            pass

        def do_POST(self):
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 10_000_000:
                self.send_error(400)
                return
            data = self.rfile.read(size)
            match = re.fullmatch(r'/frame/(\d{4})', self.path)
            complete = False
            if match and int(match[1]) < args.frames:
                (work / 'frames' / (match[1] + '.jpg')).write_bytes(data)
            elif self.path == '/status':
                try:
                    status = json.loads(data)
                except ValueError:
                    self.send_error(400)
                    return
                (work / 'status.json').write_bytes(data)
                complete = status.get('state') == 'complete'
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
            if complete and not encode_started.is_set():
                encode_started.set()
                threading.Thread(target=finish, daemon=False).start()

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Open http://127.0.0.1:{args.port}/render.html at {PROFILES[args.aspect][0]}x{PROFILES[args.aspect][1]}.', flush=True)
    print('Click 开始生成演示视频; frames and original audio are encoded automatically.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
