<h1 align="center">Electric Guitar Tabs</h1>

<p align="center">吉他练习工具：在线看谱、练习模式，效果器音色调教，分离音轨、MIDI转谱。</p>

<p align="center">中文 | <a href="README.en.md">English</a></p>

Electric Guitar Tabs 是一个在浏览器里渲染使用的吉他谱练习项目，曲谱、练习设置和音色都存在本机，后端只监听 `127.0.0.1`。界面支持中文和英文两种。

## 能做什么

**曲谱**
- 变速、循环任意区间、预备拍、跟随曲谱的节拍器、移调、唱名显示。
- 控制每条音轨的音量、独奏、静音。
- 导入 Guitar Pro、MusicXML、alphaTex 和 MIDI 文件，或者新建空白谱自己创作。
- 支持其他采用 Json 绘制的曲谱网站的链接导入，仅供个人练习，版权问题请遵守相应网站的使用条款。
- 导入 MIDI 时自动排成六线谱：量化节奏、选调弦、按手移动最少的原则分配弦和品。
- 在谱上直接编辑音符，可以撤销；按住鼠标拖动、Shift 加方向键或 Shift 点击选中几拍，复制粘贴到同一条或别的音轨（吉他和鼓之间不能互贴）；编辑时直接在谱面上改曲名和作者；编辑音轨，鼓轨可以换鼓组。
- 鼓轨也能编辑：面板里按「鼓 / 踩镲 / 镲片」分组，点一下把鼓件放到这一拍、再点一下去掉，常用的有数字键（1 底鼓、2 小鼓、3 闭镲……）；上下方向键在这一拍的几个音之间选。混音台的「新建音轨」可以新建吉他轨或鼓轨。
- 编辑时也能随时播放来听：播放时点谱面跳到那里播、拖动选循环区间；停下后编辑光标就在停下的那一拍。

**练习**
- 练习模式：设置练习速度、预备拍、循环小节，节拍器，自动切换音轨。
- 收藏：保存自己喜爱的曲子。「我的曲谱」可以按最新日期、最后日期（谱子最后修改的时间，没改过就是加入曲库的时间）或首字母排序。
- 播放列表：一首播完自动接下一首。

**音色**
- 用 SoundFont 采样音色库播放：仓库附带一套（`resources/soundfonts/Default.sf2`），自己的放在 `data/soundfonts/` 里。
- 自己调的吉他效果器音色：动态、滤波、单块、箱头、箱体、均衡、调制、延迟、混响九个模块，可以分给任意音轨。

**助手（可选，需要大模型接口）**
- 左下角抱着电吉他的小姑娘：点她，头上出现「设置」「输入框」「演奏」三个图标按钮；输入框在她脚下，回答显示在她右上方的漫画气泡里。按住拖动可以把她挪到页面任意位置，免得挡住谱子，位置会记住。
- 「演奏」：点一下开始演奏，按钮上方弹出唱名的调（跟随谱子或手动选，点别处收起）；演奏时她不聊天，曲子播放时右上方显示当前的唱名；再点一下结束。不需要模型接口也能用。
- 「设置」里可以写它的个性和你想让它知道的事（名字、说话方式、你的水平和习惯……），存在 `data/assistant.md`。
- 它能读谱、设置循环区间和速度、开关节拍器和预备拍、移调、切换音轨、播放暂停。
- 它能改谱：改音符、时值、技巧、小节（改动进入曲谱编辑器，由你保存）。
- 它能调效果器音色：新建、修改、分给音轨。
- 改了谱或音色的回答可以一键撤销。

**转谱（可选，需要 Pytorch）**
- 音轨分离：把一首歌分成多条音轨，具体数量根据选择模型而定。
- 音频转 MIDI：把音频文件转成 MIDI 文件。

## 项目结构

```
EGtabs/
├── web/               前端（Vite + React + TypeScript）：曲谱、音色、转谱三个页面和左下角的助手
├── desktop/           桌面宠物（Electron）：桌面上透明置顶的她，点她打开练琴页
├── server/            后端（Hono + SQLite，Node 直接运行 TypeScript）：曲库、在线曲谱、音色库、转谱任务和助手的接口，
│                      以及转谱用的 Python 脚本
├── contracts/         前后端共用的数据类型
├── resources/         随仓库附带的内置音色库和示例谱
├── data/              个人数据（第一次运行时自动建好，不进版本库）：曲库数据库、谱文件、自己的音色库和模型
├── test/              端到端测试，以及下载测试曲目的脚本
├── .env.example       后端设置的模板，复制成 .env.local（不进版本库）后填写
├── .gitignore
├── AGENTS.md          开发说明、代码约定和注意事项
├── LICENSE            MIT 许可
├── README.cn.md       中文说明（本文件）
├── README.en.md       英文说明
├── package.json       npm 工作区（web、server、desktop）和常用命令
├── package-lock.json
└── vitest.config.ts   单元测试的配置
```

谱面渲染和播放采用了 [alphaTab](https://www.alphatab.net/)。

## 运行

需要 **Node.js 24 或更新**（用到了内置的 `node:sqlite`，后端直接运行 TypeScript）。当前仅在 Windows 上开发和测试，其他系统未运行过。

```bash
npm ci
npm run dev
```

打开 [127.0.0.1:7273](http://127.0.0.1:7273)。网页和后端接口都在这一个端口上（`server/src/dev.ts`：网页由 Vite 提供，带热更新，`/api` 交给后端）。

第一次运行会建好 `data/` 文件夹和里面的数据库，以及要自己往里放东西的 `soundfonts/`、`models/` 子文件夹。曲库里会先放好一首示例谱「赤より紅い夢」（`resources/songs/demo/`），不需要可以直接删掉，之后不会再自动加回来。所有个人数据（曲子、练习设置、谱文件、播放列表、音色）都在 `data/user.db` 里，只需备份这一个文件夹。收藏的曲子连谱子一起存在 `user.db` 里；没收藏的曲子，谱子放在 `data/songs/` 的编号文件夹里，重启后照样保留，只有这些文件被删掉了，那首曲子才会从曲库里去掉。

不改代码时可以用 `npm start`：先构建网页，再在 7273 上提供构建好的网页和接口，不经过 Vite。

### 桌面宠物（可选）

```bash
npm run desktop
```

构建网页后启动桌面宠物（Electron）：桌面右下角出现抱着电吉他的她，透明、置顶，空白处的点击会穿过去。

- 点她：头上出现「设置」「输入框」「练琴」三个按钮。练琴页没开时，「练琴」打开它；练琴页开着时，「练琴」就是演奏按钮（开始演奏并选调，再点结束）。
- 双击她或点「练琴」：在应用自己的窗口里打开练琴页。她一直留在桌面、置顶在练琴窗口之上（练琴窗口最小化也在），只有退出应用才消失；练琴页里不再显示另一个她。
- 练琴页开着时，和她聊天就像在页面里一样：读谱、改谱、设循环和速度、调音色都作用在练琴页打开的曲子上，「撤销这些改动」也照常可用；「演奏」时她显示练琴页正在播放的唱名。练琴页没开时，她只能聊天和调音色。
- 按住拖动：挪到桌面任意位置，下次还在那里（记在 `data/desktop.json`）。
- 右键菜单：打开练琴页、接着练上次那首、开机自启（默认关）、在桌面创建快捷方式、退出。

7273 上已经有 `npm run dev` 或 `npm start` 在跑时直接用它；否则它自己在后台启动后端，退出时一起关掉（输出记在 `data/desktop.log`）。
从快捷方式或开机自启启动时不会重新构建，改了网页代码后要再运行一次 `npm run build`。

### 乐器采样库

把 `.sf2` / `.sf3` 采样音色文件放进 `data/soundfonts/`，推荐 [Polyphone](https://www.polyphone.io) 下载。
仓库里附带一套 GeneralUser GS（`resources/soundfonts/Default.sf2`，并入了 Bread 的三个失真吉他预设），打开页面时自动加载；
其他音色库需要在「音色」页里手动加载。

### 转谱功能（可选）

「转谱」模块需要 Python 和 PyTorch。

1. 准备 Python 环境，按
   [`server/separator/requirements.txt`](server/separator/requirements.txt) 里写的步骤安装依赖。
2. 启动前把环境变量 `TABS_PYTHON` 设成这个环境的 `python.exe`。
3. 「处理设备」可以选显卡或 CPU，有 NVIDIA 显卡时默认用显卡。
4. 模型文件：
   - 音轨分离：每个模型一个文件夹，放进 `data/models/separator/`，里面是 `model.ckpt` 和 `config.yaml`，
     如 `data/models/separator/BS-Roformer-SW/`，推荐 [BS-RoFormer SW](https://huggingface.co/Noshibest/BS-Roformer-SW)。
   - 音频转 MIDI：每个模型一个文件夹，放进 `data/models/transcriber/`，里面是 `model.safetensors`（和 `config.json`），
     如 `data/models/transcriber/muscriptor-medium/`，推荐 [MuScriptor](https://github.com/muscriptor/muscriptor)。
   - 节拍检测（可选）：[beat_this](https://github.com/CPJKU/beat_this) 的 `final0.ckpt`，放在 `data/models/transcriber/beat_this/`。
     有它时，MIDI 按检测到的速度和小节线写出；没有它（或在「节拍检测」里选「不检测」）时，按「速度（BPM）」框里填的速度匀速写出。

   页面上列出的就是这两个文件夹里现有的模型，放进去后刷新页面即可。



### 助手（可选）

助手接任何 OpenAI 兼容的 `/chat/completions` 接口：在线服务（如 DeepSeek），或者本机的 Ollama、LM Studio。
在 `.env.local` 里设置（见下面的「设置」），例如：

```bash
TABS_AI_BASE_URL=https://api.deepseek.com
TABS_AI_MODEL=deepseek-chat
TABS_AI_API_KEY=sk-...
```

本机服务不需要密钥时，`TABS_AI_API_KEY` 留空。这几项改了马上生效，不用重启后端；没配好时，点开宠物会说明原因。
连不上模型服务时后端会自动重试几次。有的中转服务流式输出会丢掉回答的开头，这时加一行 `TABS_AI_STREAM=false`，改为整段返回。
密钥只留在后端，网页拿不到。用在线服务时，你问的问题和用到的谱子内容会发给那个服务。模型要支持工具调用（function calling）。

## 开发

```bash
npm test            # 单元测试
npm run typecheck
npm run lint
npm run build
```

项目开发说明、代码约定和注意事项在 [`AGENTS.md`](AGENTS.md)。

## 设置（`.env.local`）

后端的设置写在仓库根目录的 `.env.local` 里：把 [`.env.example`](.env.example) 复制成 `.env.local`，按里面的注释填写（`.env.local` 不进版本库）。
每行一个 `变量=值`，`#` 开头是注释。系统环境里已经设了的同名变量优先。除了助手的三项（`TABS_AI_*`），改了都要重启后端。

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `TABS_DEV_PORT` | `npm run dev` 的端口（网页和接口） | `7273` |
| `TABS_APP_PORT` | `npm start` 和桌面宠物用的端口（构建好的网页和接口） | `7273` |
| `TABS_PORT` | 只启动后端（`npm start -w server`）时的端口 | `7274` |
| `TABS_DATA_DIR` | 数据目录 | 仓库里的 `data/` |
| `TABS_PYTHON` | 转谱用的 Python | 仓库上一级的 `.venv` |
| `TABS_SEPARATOR_MODELS` | 音轨分离模型的目录 | `data/models/separator/` |
| `TABS_TRANSCRIBER_MODELS` | 音频转 MIDI 模型的目录 | `data/models/transcriber/` |
| `TABS_SOUNDFONTS` | 自己的乐器采样库的目录（附带的那套在 `resources/soundfonts/`，总会列出） | `data/soundfonts/` |
| `TABS_DEMO_SONGS` | 第一次运行时放进曲库的示例谱的目录 | `resources/songs/demo/` |
| `TABS_AI_BASE_URL` | 助手用的模型接口地址（会加上 `/chat/completions`） | 无（不设就不启用助手） |
| `TABS_AI_MODEL` | 模型名 | 无 |
| `TABS_AI_API_KEY` | 接口的密钥，本机服务不需要 | 无 |
| `TABS_AI_STREAM` | `false`：不用流式输出，回答整段返回（给流式输出有问题的服务用） | `true` |
| `TABS_ENV_FILE` | 改用别的设置文件（只能在系统环境里设） | 仓库根目录的 `.env.local` |

## 许可

代码以 [MIT 许可](LICENSE) 发布。随仓库附带的只有内置音色库和助手形象；模型权重和其他音色库都不随代码分发，
请自行下载并遵守第三方组件和数据的许可：

- 人物形象（`web/src/assistant/pet/`）：名为 Rivus 的少女，原创者是 [jyi2ya](https://github.com/jyi2ya)，经授权使用，感谢 jyi2ya 的支持。
- alphaTab：MPL-2.0。
- 乐器采样库：附带的 `Default.sf2` 包含基本的乐器采样，可自由使用；从第三方下载的按其许可。
- 分离音轨模型：按下载的第三方模型许可。
- 转 MIDI 模型：按下载的第三方模型许可。
- 节拍检测模型：按下载的第三方模型许可。
