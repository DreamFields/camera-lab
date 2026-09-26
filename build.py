"""Assemble the modular source files in src/ into one static page, index.html.

Usage:
    python build.py            # writes index.html
    python build.py --debug    # also appends src/debug.js (adds window.__lab
                                # for headless stepping / testing; leave out
                                # of release builds)
    python build.py --offline  # writes index-offline.html: Three.js, KaTeX and
                                # the Latin webfonts are inlined, so the page
                                # runs from file:// with no network at all.
                                # Downloads go to .vendor-cache/ (first run only).

The original tabletop demo lives in legacy/plane-of-focus/ and has its own
build script (it writes plane-of-focus.html).
"""
import base64
import hashlib
import os
import re
import sys
import urllib.parse
import urllib.request

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')

THREE = 'https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js'
ADDONS = 'https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/'
KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/'
# Offline build: Latin webfonts only. Noto Sans SC is several MB of CJK subsets,
# so Chinese text falls back to the system fonts already listed in --sans.
FONTS_CSS = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400..800&display=swap'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

head = open(os.path.join(src, 'a-head.html'), encoding='utf-8').read()
body = open(os.path.join(src, 'b-body.html'), encoding='utf-8').read()

jsdir = os.path.join(src, 'js')
js = ''.join(
    open(os.path.join(jsdir, f), encoding='utf-8').read()
    for f in sorted(os.listdir(jsdir))
    if f.endswith('.js')
)

guard = '''<script>
(function () {
  var shown = false;
  function fail(msg) {
    var l = document.getElementById('loading');
    if (!l || l.classList.contains('gone') || shown) return;
    shown = true; l.classList.add('err');
    l.textContent = '试验台没能启动（' + msg + '）。请换一个支持 WebGL 2 的浏览器再试。';
  }
  addEventListener('error', function (e) { fail(e.message || '脚本出错'); });
  setTimeout(function () { if (!window.__labBoot) fail('加载超时'); }, 20000);
})();
</script>
'''

importmap = '''<script type="importmap">
{ "imports": {
  "three": "%s",
  "three/addons/": "%s"
} }
</script>
''' % (THREE, ADDONS)

if '--debug' in sys.argv:
    js += open(os.path.join(src, 'debug.js'), encoding='utf-8').read()


# --- offline build ------------------------------------------------------------------------------------------------------

def fetch(url, ua=None):
    cache = os.path.join(here, '.vendor-cache')
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, hashlib.sha1(url.encode()).hexdigest()[:16] + '-' + url.rsplit('/', 1)[-1][:40].split('?')[0])
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': ua or UA})
        data = urllib.request.urlopen(req, timeout=60).read()
        open(path, 'wb').write(data)
        print('  fetched', url)
    return open(path, 'rb').read()


def data_url(mime, data):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(data).decode('ascii'))


# import ... from 'x' / export ... from 'x' / import 'x' / import('x')
SPEC = re.compile(r'''(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\2''')


def resolve(spec, base):
    if spec == 'three':
        return THREE
    if spec.startswith('three/addons/'):
        return ADDONS + spec[len('three/addons/'):]
    if spec.startswith(('./', '../', '/')) and base:
        return urllib.parse.urljoin(base, spec)
    if spec.startswith('https://'):
        return spec
    return None


def rewrite(code, base, found):
    """Point every module specifier at its absolute URL; collect the URLs."""
    def sub(m):
        url = resolve(m.group(3), base)
        if url is None:
            return m.group(0)
        found.append(url)
        return m.group(1) + m.group(2) + url + m.group(2)
    return SPEC.sub(sub, code)


def offline_page(page_js):
    # Module graph: every vendor module becomes a data: URL, keyed in the import
    # map by its absolute CDN URL. Relative imports are rewritten to absolute
    # ones first, since they cannot resolve against a data: base.
    pending = []
    page_js = rewrite(page_js, None, pending)
    modules = {}
    while pending:
        url = pending.pop()
        if url in modules:
            continue
        code = fetch(url).decode('utf-8')
        code = re.sub(r'^//# sourceMappingURL=.*$', '', code, flags=re.M)
        found = []
        modules[url] = rewrite(code, url, found)
        pending += found
    imap = ',\n'.join(
        '  "%s": "%s"' % (u, data_url('text/javascript', c.encode('utf-8')))
        for u, c in sorted(modules.items())
    )
    print('  %d modules inlined' % len(modules))

    # KaTeX stylesheet with its woff2 fonts inlined (woff / ttf fallbacks dropped).
    kcss = fetch(KATEX + 'katex.min.css').decode('utf-8')
    kcss = re.sub(
        r'src:url\(fonts/([^)]+\.woff2)\) format\("woff2"\)[^;}]*',
        lambda m: 'src:url(%s) format("woff2")' % data_url('font/woff2', fetch(KATEX + 'fonts/' + m.group(1))),
        kcss)

    # Google Fonts: keep only the latin subset of each face.
    gcss = fetch(FONTS_CSS, UA).decode('utf-8')
    faces = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face\s*\{[^}]*\})', gcss)
    gcss = '\n'.join(
        re.sub(r'url\((https://[^)]+)\)', lambda m: 'url(%s)' % data_url('font/woff2', fetch(m.group(1))), face)
        for subset, face in faces if subset == 'latin'
    )

    h = head
    for pat in (r'<link rel="preconnect"[^>]*>\n', r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n',
                r'<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/npm/katex[^>]*>\n'):
        h, n = re.subn(pat, '', h)
        assert n, 'offline build: head no longer matches ' + pat
    h = h.replace('<style>', '<style>\n' + gcss + '\n' + kcss + '\n', 1)

    imap = '<script type="importmap">\n{ "imports": {\n' + imap + '\n} }\n</script>\n'
    return h + body + guard + imap + '<script type="module">\n' + page_js + '</script>\n</body>\n</html>\n'


if '--offline' in sys.argv:
    out, name = offline_page(js), 'index-offline.html'
else:
    out, name = head + body + guard + importmap + '<script type="module">\n' + js + '</script>\n</body>\n</html>\n', 'index.html'

open(os.path.join(here, name), 'w', encoding='utf-8').write(out)

print(len(out), 'bytes ->', name)
