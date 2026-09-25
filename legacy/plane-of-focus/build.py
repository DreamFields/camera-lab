"""Legacy page: assemble legacy/plane-of-focus/src/ into ../../plane-of-focus.html.

This is the original tabletop "plane of focus" demo, kept as-is next to the
camera lab (whose sources live in the top-level src/).

Usage:
    python legacy/plane-of-focus/build.py            # writes plane-of-focus.html
    python legacy/plane-of-focus/build.py --debug    # also appends src/debug.js
"""
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'src')

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
    l.textContent = '三维场景没能启动（' + msg + '）。请换一个支持 WebGL 2 的浏览器再试。';
  }
  addEventListener('error', function (e) { fail(e.message || '脚本出错'); });
  setTimeout(function () { if (!window.__pofBoot) fail('加载超时'); }, 20000);
})();
</script>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/"
} }
</script>
<script type="module">
'''

if '--debug' in sys.argv:
    js += open(os.path.join(src, 'debug.js'), encoding='utf-8').read()

out = head + body + guard + js + '</script>\n'

root = os.path.normpath(os.path.join(here, '..', '..'))
open(os.path.join(root, 'plane-of-focus.html'), 'w', encoding='utf-8').write(out)

print(len(out), 'bytes ->', 'plane-of-focus.html')
