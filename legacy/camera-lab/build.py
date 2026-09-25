"""Legacy page: assemble legacy/camera-lab/src/ into ../../camera-lab.html.

This is the panel-based camera lab, kept as-is next to the new bench page
(whose sources live in the top-level src/).

Usage:
    python legacy/camera-lab/build.py            # writes camera-lab.html
    python legacy/camera-lab/build.py --debug    # also appends src/debug.js
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
    l.textContent = '试验台没能启动（' + msg + '）。请换一个支持 WebGL 2 的浏览器再试。';
  }
  addEventListener('error', function (e) { fail(e.message || '脚本出错'); });
  setTimeout(function () { if (!window.__labBoot) fail('加载超时'); }, 20000);
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

out = head + body + guard + js + '</script>\n</body>\n</html>\n'

root = os.path.normpath(os.path.join(here, '..', '..'))
open(os.path.join(root, 'camera-lab.html'), 'w', encoding='utf-8').write(out)

print(len(out), 'bytes -> camera-lab.html')
