# 演示视频与网站封面

制作日期：2026-10-11。页面和渲染源码基于 UI 提交 `080a4af`。

## 成品

| 文件 | 规格 | 内容 |
| --- | --- | --- |
| [横屏成片](camera-lab-demo-16x9.mp4) | 1920 × 1080，16:9，30 秒，30 fps | 宽幅镜头；取景画面与参数提示左右排列 |
| [竖屏成片](camera-lab-demo-3x4.mp4) | 1080 × 1440，3:4，30 秒，30 fps | 竖版镜头；标题、取景画面与操作提示上下排列 |
| [横屏网站封面](camera-lab-cover-16x9.png) | 1920 × 1080，PNG | `index.html` 的真实界面截图 |
| [竖屏网站封面](camera-lab-cover-3x4.png) | 1080 × 1440，PNG | `index.html` 的真实界面截图 |

两版视频均为 H.264 + AAC 立体声，带原创合成配乐、转盘提示音与快门音。MP4 使用 faststart，便于在线播放。封面保留网站本来的标题、工具栏、读数和场景标注；不使用视频字幕画布或视频截帧作为网站封面。

文件尺寸、视频参数和 SHA-256 校验值记录在 [manifest.json](manifest.json)。

## 需求、设计与实施范围

- 目标：用约 30 秒展示项目可以亲手操作的部分，并提供横屏和竖屏高清成品。
- 验收：两版各 900 帧、30 fps、30 秒；封面必须来自真实网站界面，并与对应成片比例一致。
- 分镜：拆装 → 对焦环与光路 → 实时取景调焦 → 昼夜切换 → 变焦联动 → 拍照与底片。
- 实现：保留本项目 Three.js 场景、光学和照片管线；导出工具负责镜头调度、字幕、参数提示、原始帧存储、音轨和视频编码。网站源码不因制作视频而修改。

视频中的字幕、参数卡和指针由演示导出画布绘制；镜头、山谷、光路及照片均来自项目实际渲染。演示驱动直接调度模型参数，不依赖人工拖动的录屏帧率。

## 分镜时间表

| 时间 | 演示内容 | 实际模型变化 |
| --- | --- | --- |
| 0–4 秒 | 一台可以拆开的相机 | 相机从组装状态逐渐拆开，露出镜片与传感器 |
| 4–9 秒 | 转动对焦环 | 对焦距离从约 28 cm 移向 66 cm，焦平面与光路同步变化 |
| 9–16 秒 | 清晰，由你决定 | 实时取景中对焦距离从 28 cm 移向 70 cm，观察清晰区与散景 |
| 16–21 秒 | 三种光线 | 晴天 → 黄昏 → 夜晚，曝光参数与画面同步更新 |
| 21–26 秒 | 转动变焦环 | 焦距从 35 mm 移向 100 mm，机身滑动、皮腔和实时屏同步变化 |
| 26–30 秒 | 拍照 | 回到黄昏取景，在第 27 秒释放快门并显示实际拍下的底片 |

## 本次生成过程

1. 先提交网站 UI 修改，确认页面能够正常启动，视角切换、公式、读数、取景器和隐藏界面功能正常。
2. 从 `src/a-head.html`、`src/b-body.html` 和按名称排序的 `src/js/*.js` 组装演示页面。从 `index-offline.html` 取出内联 import map，使视频渲染不依赖外部 CDN。
3. 添加 [竖版分镜驱动](../../tools/demo-video/portrait.js) 和 [横版分镜驱动](../../tools/demo-video/landscape.js)。横版重新调整镜头位置、取景区域与字幕布局。
4. 设置浏览器内容视口为成片尺寸。暂停自动帧循环，按每帧 1/30 秒推进 `tick()`；保留模型自身的参数缓动、照片处理和运动物体。
5. 输出画布在本帧完成渲染后立即复制 WebGL 画面，再绘制字幕与参数提示。使用 JPEG 质量 0.97 输出 `0000.jpg` 至 `0899.jpg`。底片读回尺寸为 1080 × 720。
6. 用 [audio.py](../../tools/demo-video/audio.py) 合成 48 kHz 立体声音轨。素材由正弦波和包络组成，没有引用外部音乐。
7. 使用 FFmpeg 的 libx264、CRF 18、medium preset 编码；音轨编码为 192 kbps AAC，合成为 30 秒 MP4。
8. 浏览器打开真实 `index.html`，选择黄昏、全景、拆开相机，关闭电影镜头及公式/读数抽屉；分别以 1920 × 1080 和 1080 × 1440 内容视口直接截图。截图数据按实际编码转换为真正的 PNG，不增加视频字幕。
9. 检查各段代表帧和浏览器播放，完整解码两版 MP4，检查时长、比例、帧数、音轨和封面格式，生成 SHA-256 清单。

两张网站封面均为黄昏、50 mm、ISO 100、对焦 38 cm、白平衡 5200 K。横版保留开场的 ƒ/2、1/500 秒；竖版为 ƒ/4、1/125 秒。它们是两个视口下的实际页面，未裁剪或重新拼版。截图后另用媒体探针核对实际像素尺寸，避免把浏览器缩放后的图片误标为内容视口尺寸。

## 重新生成

需要 Python 3、带 WebGL 2 的浏览器、PATH 中可用的 `ffmpeg` 和 `ffprobe`。Python 工具只使用标准库。当前仓库已经带有内联依赖的 `index-offline.html`。

在仓库根目录运行横版：

```powershell
python tools/demo-video/render.py --aspect landscape --port 8770
```

打开终端给出的 `http://127.0.0.1:8770/render.html`。把浏览器**内容视口**设置为 **1920 × 1080**，例如使用浏览器开发者工具的响应式尺寸设置，然后点击「开始生成演示视频」。生成期间保持该视口尺寸不变。帧输出完成后会自动合成 `media/demo/camera-lab-demo-16x9.mp4`。

竖版：

```powershell
python tools/demo-video/render.py --aspect portrait --port 8771
```

打开 `http://127.0.0.1:8771/render.html`，内容视口设置为 **1080 × 1440**，点击生成。输出为 `media/demo/camera-lab-demo-3x4.mp4`。

默认中间文件在被 Git 忽略的 `.demo-video-work/<aspect>/`，包括页面、JPEG 帧、WAV、输入源码校验记录和生成状态。终端及 `result.json` 出现 `state: encoded` 后即可关闭本地服务。默认命令会更新对应成片；如需保留原文件，可指定 `--output`。已有帧的工作目录不会被覆盖，再次生成请使用新的 `--work-dir`：

```powershell
python tools/demo-video/render.py --aspect landscape --work-dir .demo-video-work/landscape-v2 --output .demo-video-work/landscape-v2/demo.mp4
```

已有完整帧时可以仅重新编码：

```powershell
python tools/demo-video/render.py --aspect landscape --encode-only
```

快速验证工具流程可添加 `--frames 3`，同时指定独立工作目录和输出文件；这只输出 0.1 秒短样片。`--prepare-only` 只组装页面和音轨，不启动服务。

分镜和输出规格可以重现；不同 GPU、浏览器、字体、异步测光时序和 FFmpeg 版本可能影响细节及文件字节。生成工具会在 `recipe.json` 记录源码 SHA-256，便于确认输入版本。

## 验证

```powershell
python tools/demo-video/verify.py
```

该命令校验两版尺寸、帧率、900 帧、30 秒、H.264/AAC、PNG 实际编码及 SHA-256，并完整解码视频。主动更换成品后，再检查内容并更新清单：

```powershell
python tools/demo-video/verify.py --write-manifest
```

本次整理已检查两版成品与真实网站封面，并验证横竖两种配置的短样片渲染、帧接收、音轨生成和自动编码流程。
