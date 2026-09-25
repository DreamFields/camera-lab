# 焦平面实验台 · Plane of Focus Lab

一个用 Three.js 做的交互式 3D 科普页面：一只可以拆开的 50mm 镜头、一块磨砂像平面、一座微缩山谷，直观演示「焦平面」「景深」「光圈」和「弥散圆」这几个摄影光学概念。

在线预览：将本仓库以静态站点方式部署（见下方「本地运行」），或直接打开构建产物 [`index.html`](index.html) / [`plane-of-focus.html`](plane-of-focus.html)。

![tech](https://img.shields.io/badge/three.js-r183-black) ![no build tool](https://img.shields.io/badge/build-plain%20JS%20%2B%20python-blue)

## 这是什么

拖动镜头上的对焦环，能看到：

- 一张发光的**焦平面**网格在山谷里前后移动，它扫过谁，谁就在焦平面上；
- 松树、小屋、雪山三个物体各自发出一束光线，穿过镜头汇聚到后方的像平面（磨砂玻璃）上；落在焦平面上的物体，光线汇成**一个点**——清晰；不在焦平面上的物体，光线在玻璃上摊成一个**光斑（弥散圆）**——模糊；
- 玻璃上实时渲染着这只镜头真正"拍"到的画面（做了透视投影 + 景深模糊 + 上下颠倒），不是贴图或视频；
- 收缩光圈（f/2 → f/16），清晰区会跟着变深，直观对应"大光圈虚化背景 / 小光圈风光全清晰"的经验规律。

## 功能

- **物理正确的景深计算**：按 50mm 全画幅镜头、弥散圆直径 0.03mm 建模，超焦距、近点/远点、每个物体的弥散圆大小都是公式算出来的，不是摆出来的效果。
- **镜头可以拆开**：前组镜片、对焦组、光圈叶片（9 片虹膜，跟随光圈值张合）、后组镜片会沿光轴分开，露出内部结构；对焦时对焦组真的会在镜筒里前后移动，齿轮跟着转。
- **控制台**：5 格胶片显示 5 个对焦距离下的实时画面；可拖拽的对焦旋钮/滑块；3 档光圈快捷按钮。
- **自由视角**：左键拖拽旋转、右键拖拽平移、滚轮/双指缩放、WASD 走位、QE 转向。
- **电影镜头**：无操作时自动在 7 个预设机位间巡游，并演示调焦/光圈变化；用户一操作立即让出控制权。
- **响应式 + 深色界面**，移动端控制面板收纳到底部；`prefers-reduced-motion` 关闭电影镜头自动播放。
- 键盘快捷键、原理说明弹窗，细节见页面内「?」按钮。

## 本地运行

只有一个 Python 脚本负责把 `src/` 下的分片文件拼成单个 HTML；没有 npm / 构建工具依赖。

```bash
python build.py
python -m http.server 8765
```

然后打开 <http://localhost:8765/>。**必须**用 HTTP(S) 打开（`file://` 下 ES module import map 会被浏览器拦截），Three.js 通过 CDN（`cdn.jsdelivr.net`）以 import map 方式引入，无需 `npm install`。

`.claude/launch.json` 是给 [Claude Code](https://claude.com/claude-code) 内置浏览器预览用的启动配置，与运行本项目无关，可以忽略或删除。

## 目录结构

```
src/
  a-head.html    # <head>：字体、CSS 变量、全部样式
  b-body.html    # <body>：DOM 骨架（读数卡片、控制台、说明弹窗）
  js/
    01-core.js     # 光学公式、渲染器/场景/灯光、通用 helper
    02-valley.js   # 微缩山谷：地形、树木、小屋、雪山、天空
    03-lens.js     # 镜头模型：镜片、光圈虹膜、对焦/变焦齿轮
    04-bench.js    # 光具座、像平面支架、控制台三维部件
    05-optics.js   # 景深渲染（离屏相机 + 后期模糊）、焦平面、光线可视化
    06-camera.js   # 轨道相机、电影镜头自动巡游
    07-ui.js       # DOM 读数绑定、3D 标签、指针/键盘交互
    08-loop.js     # 后期处理、resize、主循环
  debug.js       # 仅 --debug 构建附加：暴露 window.__pof 供无头测试单步推进
build.py         # 拼接 src/ → plane-of-focus.html / index.html
```

改动场景/交互时改 `src/` 下对应文件，然后重新 `python build.py`；两个产物文件是生成物，不建议手改。

## 出处与致谢

这个项目的构思——用一只可拆解的镜头 + 微缩场景来讲解焦平面——参考自 **Ryan Sael** 的作品 [*The Plane of Focus*](https://sael.net/plane-of-focus/)（sael.net）。原作页面上明确写了"代码、外观与场景均为原创，复用需征得作者许可并署名"，特此说明：

- 本仓库的代码、3D 建模方式、着色器、文案、视觉细节均为**独立编写**，没有查看或拷贝原站的源代码；
- 交互形态（对焦环拖拽、光圈预设、拆开/组装、电影镜头自动巡游等）在**概念**上向原作致敬，具体实现、数值、美术风格是自己的；
- 如果你是从这个仓库二次学习/借鉴思路，建议同样注明这一层出处，并在涉及商业使用或较大范围传播前，考虑联系原作者。

## 技术栈

纯原生 JavaScript（ES Module）+ [Three.js](https://threejs.org/) r183，无框架、无打包器；构建仅靠一个几十行的 Python 脚本做字符串拼接。

---

<sub>由 <a href="https://claude.com/claude-code">Claude Code</a> 协助实现。</sub>
