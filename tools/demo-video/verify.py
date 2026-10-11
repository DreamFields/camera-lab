"""Check the shipped videos/covers and optionally record their SHA-256 manifest."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)
    ], text=True, encoding='utf-8'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write-manifest', action='store_true')
    args = parser.parse_args()
    files = {}
    for suffix, width, height in [('16x9', 1920, 1080), ('3x4', 1080, 1440)]:
        for kind, extension in [('demo', 'mp4'), ('cover', 'png')]:
            path = REPO / 'media/demo' / f'camera-lab-{kind}-{suffix}.{extension}'
            info = probe(path)
            video = next(s for s in info['streams'] if s['codec_type'] == 'video')
            assert (video['width'], video['height']) == (width, height), f'Wrong dimensions: {path.name}'
            if kind == 'demo':
                assert video['codec_name'] == 'h264'
                assert video['r_frame_rate'] == '30/1'
                assert int(video['nb_frames']) == 900
                assert abs(float(info['format']['duration']) - 30) < .05
                assert any(s['codec_name'] == 'aac' and s['channels'] == 2 and s['sample_rate'] == '48000'
                           for s in info['streams'])
                subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True)
            else:
                assert video['codec_name'] == 'png', f'Cover must actually be PNG: {path.name}'
            files[path.name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                'bytes': path.stat().st_size, 'width': width, 'height': height,
                                'codec': video['codec_name']}
            if kind == 'demo':
                files[path.name].update(duration_seconds=30, fps=30, frames=900,
                                        pixel_format=video['pix_fmt'], audio='AAC stereo, 48000 Hz')
            print(f'OK: {path.name}')
    if args.write_manifest:
        manifest = {'created_date': '2026-10-11', 'source_ui_commit': '080a4af',
                    'covers': 'Direct browser screenshots of index.html, without video overlays.',
                    'files': files}
        (REPO / 'media/demo/manifest.json').write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    else:
        manifest = json.loads((REPO / 'media/demo/manifest.json').read_text(encoding='utf-8'))
        assert files == manifest['files'], 'Media differs from the recorded manifest.'


if __name__ == '__main__':
    main()
