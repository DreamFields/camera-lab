"""Assemble the modular source files in src/ into one static HTML page.

Usage:
    python build.py            # writes plane-of-focus.html + index.html
    python build.py --debug    # also appends src/debug.js (adds window.__pof
                                # for headless stepping / testing; leave out
                                # of release builds)
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

for name in ('plane-of-focus.html', 'index.html'):
    open(os.path.join(here, name), 'w', encoding='utf-8').write(out)

print(len(out), 'bytes ->', 'plane-of-focus.html, index.html')
