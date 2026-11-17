# 项目介绍

为吉他爱好者开发的曲谱练习网站：支持在线看六线谱、练习模式（变速、循环、节拍器、移调），调教效果器音色，同时支持把音频分离出多条单乐器音轨、转成 MIDI 、MIDI转谱；左下角的助手（宠物）接大模型，帮用户看谱、练习、改谱、调音色。

## 目录

- `web/`：前端（Vite + React + TypeScript，CSS Modules）。
  - `src/app/`：外壳，拼起顶栏、乐谱区、控制条、三个页面和左下角的助手。
  - `src/shared/`：请求封装、地址路由、公共面板样式、`ui/`（Popover、主题、`i18n.ts`）、`alphabetical.ts`（按首字母排序）。
  - `src/audio/`：效果器信号链和引擎（AudioWorklet）、音轨分路、「同一时间只响一种声音」`soundOwner.ts`。
  - `src/tabs/`：曲谱页。`player/`（alphaTab 控制器 `controller.ts`、曲谱编辑、音轨编辑、移调）、`library/`（曲库、
    导入、新建空白谱、导入 MIDI `midiFile.ts` / `midiScore.ts`、播放列表）、`layout/`（顶栏、乐谱区、控制条）、
    `songs/`（在线曲谱 JSON → alphaTab 的转换器）。
  - `src/tones/`：音色页（采样音色库、效果器音色库）。
  - `src/stems/`：转谱页（处理设备、音轨分离、音频转 MIDI）。
  - `src/assistant/`：左下角（控制条上方）的助手，拖动宠物可以挪到页面别处（`petPlace.ts`，位置记在浏览器里；桌面宠物改为拖动整个窗口）。`Pet.tsx`（形象：名为 Rivus 的 Q 版小姑娘和她的电吉他，原创者 [jyi2ya](https://github.com/jyi2ya)，经授权使用，README 的「许可」里有致谢。画面是 16:9、人物居中留白的帧，
    显示时裁到人物本身；现在只有一张 `pet/idle.png` 静止显示，动画之后做成同样画幅的透明 webm，`pet/prompts/` 是生成视频的提示词；
    只播放画好的帧，不另加效果）、`Assistant.tsx`（漫画气泡、输入框；点宠物在它头上出现「设置」「输入框」「演奏」三个图标按钮，各自开关；
    点「演奏」开始并在按钮上方弹出选调面板，再点结束；演奏时不能聊天，曲子播放时气泡的位置无底色地显示唱名（`tabs/layout/NoteNames.tsx`，由 `app/` 传进来），开关记在浏览器里）、`PetSettings.tsx`（编辑 `data/assistant.md`）、
    `conversation.ts`（对话循环：模型 → 工具 → 模型，限步数、可停止）、`tools.ts`（工具，在页面里执行）、`prompt.ts`、
    `stream.ts`（解析流式回答）、`toneText.ts`（音色模块目录、效果链的读写校验）。谱子的文字形式在 `tabs/player/scoreText.ts`。
  - `alphatab-patches.ts`：构建时对 alphaTab 源码做的精确替换。
- `desktop/`：桌面宠物（Electron 45，主进程 `main.ts` 由 Electron 自带的 Node 直接运行 TypeScript）。透明置顶的小窗加载 `web/desk.html`
  （`web/src/desk/`：只有助手，复用 `Assistant.tsx`，多一个「练琴」按钮：练琴窗口没开时打开它，开着时就是演奏按钮）；`preload.cjs` 给页面 `window.desk`（点击穿透、拖动挪窗口、
  打开练琴页、右键菜单、和练琴窗口通信）。练琴页在应用自己的窗口里（`practice.cjs` 给它 `window.deskHost`），页面里不放助手，
  只放 `assistant/DeskHostLink.tsx`；宠物一直在桌面、置顶，退出应用才消失。对话在宠物的窗口里跑，练琴窗口开着时工具交给它执行
  （`assistant/toolHost.ts`：系统提示和工具都用练琴窗口的播放器，撤销步骤留在练琴窗口、按编号取；主进程转发 `desk:call` → `host:request` →
  `host:reply`，播放状态 `host:view` → `desk:view` 供「演奏」显示唱名）。7273 上没有服务时用 Electron 的 Node 启动 `server/src/serve.ts`，
  退出时关掉。宠物的位置记在 `data/desktop.json`。`launch.ts` 是 `npm run desktop` 的启动脚本。
- `contracts/`：前后端交换的数据类型，只定义一次（曲目、播放列表、分轨和转换记录、模型、音色库）；后端的模块转出它们，
  网页的 `api.ts` 引用它们。只放类型，用 `import type` 引用，两边的构建里都不留下东西。
- `server/`：后端（Hono，Node 直接运行 TypeScript）。
  - `src/dev.ts` 是 `npm run dev` 的入口：一个端口（7273）上网页由 Vite 中间件提供（带热更新），`/api` 交给后端；
    `src/serve.ts` 是 `npm start` 和桌面宠物用的：同一个端口上提供构建好的 `web/dist`（`index.html` 和 `desk.html`）和接口，不经过 Vite；
    `src/index.ts` 只启动后端（7274，端到端测试用它配 Vite 自己的服务器）。
  - `src/app.ts` 装配路由，`src/routes/` 各功能的接口，`src/db/` SQLite（`node:sqlite`）。
  - `src/assistant.ts`：把对话转发给 OpenAI 兼容的 `/chat/completions`（流式），密钥只在后端；用哪个服务和模型由 `src/env.ts` 读 `.env.local`。
    `src/persona.ts`：宠物的个性 `data/assistant.md`（第一次启动按模板生成；每次提问都重读，去掉 `<!-- -->` 注释后接在系统提示的内置规则后面）。
  - `src/tasks.ts`：转谱页两个功能共用的任务队列、显卡锁、调用 Python 脚本。`src/stems.ts` 音轨分离，`src/transcribe.ts` 音频转 MIDI。
  - `separator/`：Python 脚本 `separate.py`（audio-separator）、`transcribe.py`（MuScriptor + beat_this），依赖见 `requirements.txt`。
- `resources/`（随库附带，和个人数据分开）：`soundfonts/Default.sf2`（内置音色库：GeneralUser GS 并入了 Bread 的三个
  失真吉他预设，放在 1000 号库；默认那套），`songs/demo/`（随库附带的谱，现在是用户自己做的「赤より紅い夢」；全新的曲库第一次启动时导入并设为收藏，
  删掉后不再加回来，`db/library.ts` 的 `addDemos`）。
- `data/`（个人数据，整个不进版本库；第一次启动时自动建好它、`user.db` 和要自己往里放东西的
  `soundfonts/`、`models/separator/`、`models/transcriber/`）：
  - `user.db`：曲子、练习设置、播放列表、音色库，以及**收藏曲子**的谱子内容（上传的文件、在线曲谱的修订版、编辑版）。
  - `assistant.md`：宠物的个性和用户想让它知道的事（宠物的「设置」面板编辑它，也可以直接改文件）。
  - `songs/`：按 1、2、3… 编号的文件夹（`server/src/songs/songFolders.ts`），每个里有 `origin.json` 说明是什么：
    在线曲谱的一个修订版（`meta.json` + `{音轨}.json`）或上传的文件。**没收藏的曲子**的谱子只在这里；收藏时搬进
    `user.db`、取消收藏时搬回来（`db/library.ts`）。启动时没收藏的曲子和「最近打开」都保留，
    只有谱子在这里找不到的才从曲库去掉。
  - `tmps/`（本次运行的分轨和转换结果，启动时清空）、`soundfonts/`（自己放的乐器采样库，和 `resources/soundfonts/`
    一起列出，同名时用这里的）。
  - `models/separator/<名字>/model.ckpt` + `config.yaml`、`models/transcriber/<名字>/model.safetensors`（+ `config.json`）：
    两个模型目录都按文件夹扫描，有什么列什么；分离模型分出哪几轨读它 YAML 里的 `training.instruments`。
    节拍检测可选：`models/transcriber/beat_this/*.ckpt`；没有或选「不检测」时按页面上填的速度匀速写 MIDI。
- `test/`（测试脚本）：`e2e.ts`、`e2e-songs.ts`、`fetch-fixtures.ts`；`songs/` 是 10 首测试曲目（清单在 `web/src/fixtures.ts`，
  `npm run fixtures` 下载，是在线曲谱的内容，不进版本库）。

## 命令

```bash
npm ci
npm run dev          # 网页和接口都在 7273（server/src/dev.ts）；改后端文件自动重启，改网页文件走 Vite 热更新
npm run build        # 构建 web/dist（index.html 和桌面宠物的 desk.html）
npm start            # 构建后由 server/src/serve.ts 在 7273 上提供构建好的网页和接口
npm run desktop      # 构建后启动桌面宠物（desktop/）
npm test             # vitest 单元测试（测试曲目缺失时相关测试跳过）
npm run typecheck
npm run lint         # oxlint
npm run e2e          # 无头 Edge 跑全流程（端口 5183/5184、临时数据目录；--shots 截图到 test/shots/ DEBUG）
npm run e2e:songs    # 渲染 10 首测试曲目的全部音轨
npm run fixtures     # 把测试曲目下载到 test/songs/
```

后端的设置：仓库根目录的 `.env.local`（不进版本库，`.env.example` 列出全部并有注释；`src/env.ts` 启动时读进 `process.env`，
系统环境里已有的优先；`TABS_ENV_FILE` 可指向别的文件，e2e 用它指向自己写的一份，开发者的 `.env.local` 不会混进测试）。变量：`TABS_DEV_PORT`（`npm run dev` 的端口）、`TABS_APP_PORT`（`npm start` 和桌面宠物的端口）、`TABS_PORT`（只启动后端时的端口）、`TABS_DATA_DIR`、`TABS_PYTHON`、`TABS_SEPARATOR_MODELS`、`TABS_TRANSCRIBER_MODELS`、`TABS_SOUNDFONTS`、`TABS_DEMO_SONGS`（随库附带的谱的目录；e2e 指向空目录，免得新曲库里多出它）。
`TABS_AI_BASE_URL` / `TABS_AI_MODEL` / `TABS_AI_API_KEY` / `TABS_AI_STREAM`（助手的模型，每次请求都重读 `.env.local`，改了不用重启；e2e 指向脚本写好的假服务）。
连接模型服务失败（还没收到回答就被重置等）时后端重试 6 次；`TABS_AI_STREAM=false` 时向服务要整段回答，再以一段流的格式交给网页（用户的中转服务流式输出会丢开头，2026-11-18）。
加新设置时同步 `.env.example` 和两份 README 的表格。

## 代码约定

- 和用户用中文交流；代码、标识符、提交信息用英文，注释跟随周围代码。
- 修改了界面文字要同步英文对照表和 `docs/note.md`（见下）。
- 乐谱区用配置 alphaTab 实现，求内容、结构、行为一致，不求逐像素。配置和 CSS 解决不了的差异先告诉用户，不要重写渲染层。
- 音轨分离、音频转 MIDI 的模型在本机跑，权重不进仓库，放 `data/models/`。
- 助手的模型走 OpenAI 兼容接口（在线服务或本机的 Ollama 等都行），在 `.env.local` 里配置；密钥只在后端，不进网页和数据库。
  工具在页面里执行（谱子在浏览器内存里），只走 `usePlayer()` 的控制器方法；参数由工具自己校验，出错把原因文字交回模型，不抛给页面。
  改谱经 `controller.assistantEdit()` 走曲谱编辑器（`tabs/player/tabEdits.ts` 把操作翻成编辑器命令，`TabEditor.group()` 合成一步撤销），
  不直接存盘，由用户在编辑器里保存。改了用户保存的东西（音色、音轨用哪个音色、曲谱）的工具要给出撤销步骤：气泡里「撤销这些改动」一次撤回整个回答的改动，下次提问时告诉模型。
- alphaTab 的播放器 API 只在 `tabs/player/controller.ts` 里调用；其他组件用 `usePlayer()` 拿快照和方法。播放状态以 alphaTab 的事件为准，React 里不另存一份播放位置。
- 当前打开哪首曲子以地址栏 `#/song/{id}` 为准；音色页（`#/tones`）和转谱页（`#/stems`）盖在乐谱区上，不关闭曲子。
- 依赖边界：`audio/`、`shared/` 不引用任何功能模块；转谱页（`stems/`）不引用曲谱和音色；助手（`assistant/`）只通过控制器用曲谱（另外只引用 `tabEdits.ts` 的说明常量）、通过 `toneStore` 和 `tones/library.ts` 用音色，没有页面引用它（只有 `app/` 把它放上去）；曲谱只通过 `tones/library.ts` 的查找函数和 `useTones()` 用音色；互相打断播放只走 `soundOwner`。
- 界面文字都经过 `t()`（组件外用 `translate()`），中文原文作键；新中文要在 `shared/ui/i18n.ts` 的 EN 表里加英文，`i18n.test.ts` 会检查。不是界面文字的中文（比如排序用的汉字）写成转义。
- 界面上的说明、提示文字登记在 `docs/note.md`（编号、场景、文字、文件:行号、「修改」列）。增删改这类文字时同步更新；用户在「修改」列填了新文字（「无文本」表示删掉）后，按编号改代码、英文对照表 `docs/note.md`。
- 样式用 CSS Modules + CSS 变量，不引入 UI 组件库。TypeScript 开着 `erasableSyntaxOnly`：不用构造函数参数属性和 enum。
- 单元测试 `*.test.ts` 和被测代码以及测试曲目放在一起。
- 按音轨下标记的设置（音色、采样音色、自动切换音轨、手动选的音轨）和播放器快照的 `tracks` 都按谱里的顺序；列表只在显示时排序（`shared/alphabetical.ts`）。
- 曲谱编辑直接改内存里的乐谱，每步后调 `score.finish()`；撤销靠按字段复制的快照（`modelClone.ts`）。改这块先读 `tabEditor.ts` 的注释。

## alphaTab 1.8.4 的坑（升级后逐条复查）

- 不要订阅 `api.midiLoaded`（栈溢出，整页空白）；不用自带的预备拍（用 `clicks.ts`）；不用 `StaveProfile.Tab`（鼓轨崩溃）；不用 `changeTrackTranspositionPitch`（移调要重新渲染一份改写过品位的乐谱）。
- 改了乐谱要用 `api.renderer.renderScore()` 发给 Worker（`render()` 只重排旧副本），要让播放跟上再调 `loadMidiForScore()`。重新加载 MIDI 会清掉位置、循环、混音，由 `reloadMidi()` / `applyPending()` 恢复。
- 独奏、静音、音量按 MIDI 通道保存，换曲子不会清零：`resetMixer()` / `applyMixer()`。
- 每个小节的声部数量必须一致，任何声部都不能没有拍；长短混合的三连音分组不可靠（导入 MIDI 时写成等长三连音）。
- 循环区间要等渲染完才能设；`renderFinished` 时谱面的 svg 可能还没插进页面；新的 bounds 要等 `postRenderFinished`。
- 鼓音符的 `percussionArticulation`：音轨有自己的 `percussionArticulations` 时是表内下标，没有时是鼓件编号（我们的在线曲谱和 MIDI 转换器都是后者）。
  原版 GP7 导出器对没有表的音轨写默认表却照抄编号，读回来全错成邦戈、康加（2026-11-17）；补丁已改导出器，之前存坏的谱在
  `onScoreLoaded` 里由 `drumArticulations.ts` 修复。鼓组：路由只接管鼓通道的 program 0，`midiDrums` 分支也读路由表（补丁）。
- 鼓轨编辑：编辑器光标的 `string` 在鼓轨上是谱线位置（从第一线往下数的半格，3 是小鼓那一间），只停在这一拍已有的音上；面板的分组和数字键在 `DRUM_PALETTE`。可选的鼓件 `drumPieces.ts`
  抄自 alphaTab 没导出的 `PercussionMapper` 表；升级后 `drumEditing.test.ts` 会把它和 alphaTab 实际写出的表逐项比对。
- `alphatab-patches.ts` 找不到原文就报错；升级 alphaTab 后先跑构建，逐条核对补丁。

## 开发服务器

- `npm run dev` 跑 `server/src/devWatch.ts`：它启动 `dev.ts`，监视 `server/src/`、`contracts/`，以及 `web/alphatab-patches.ts`、`web/vite.config.ts`
  这两个文件（Vite 在内存里留着上次打过补丁的 alphaTab，改补丁要整个重启，之后刷新页面），改了就重启。不要改成监视 `web/`
  或用 `node --watch`：Vite 读 `vite.config.ts` 时会生成一个临时文件、加载后马上删掉，会被当成改动而无限重启（2026-11-11 踩过）。
- 也不要换回 `node --watch-path`：它在一次启动失败后只等下一次改动，而 Windows 上刚重启时旧进程可能还占着端口或文件，
  偶尔失败一下后端就一直停着（2026-11-12）。`devWatch.ts` 启动失败会隔 1.5 秒重试 3 次，还失败（代码真有错）才等改动。
- 端口被占用时 `dev.ts` 会说明原因并退出；真有另一个 `npm run dev` 在跑时，`devWatch.ts` 重试 3 次后停下等改动。

## 桌面宠物（Electron）

- 从 VS Code 的终端启动时环境里带着 `ELECTRON_RUN_AS_NODE=1`，Electron 会变成普通 Node（`import electron` 得到空对象）：
  `desktop/launch.ts` 去掉它再启动；主进程启动后端时反过来设上它，用 Electron 自带的 Node 跑 `serve.ts`。
- `electron` 是 CommonJS：主进程里 `import electron from 'electron'` 再解构，不能直接具名导入。预加载脚本只能是 CommonJS 的 JS（`preload.cjs`）。
- 安装依赖后 Electron 的程序文件由它的 `install.js` 下载，下载失败时 `node node_modules/electron/install.js` 重试。

## Python（转谱页，可选）

- 只有音轨分离和音频转 MIDI 用到 Python；网页和其他功能不需要。后端用 `TABS_PYTHON` 指定解释器。
- 安装步骤和需要降回的包写在 `server/separator/requirements.txt` 里；audio-separator 要 `--no-deps` 装。装新包前先看会不会升级已有的包（`pip install --dry-run`），如果环境和其他项目共用，要先问用户。
- 脚本不联网下载权重，只读 `data/models/` 里的本地文件；每行输出一个 JSON（`{"progress": …}` 等），最后一行 stderr 是错误。
- 选 CPU 时设 `CUDA_VISIBLE_DEVICES=-1`（空字符串藏不住显卡）。音频由浏览器解码成 44.1 kHz WAV 后上传，后端不依赖 ffmpeg。

## 验证

- 改了播放器或布局，至少跑 `npm test` 和 `npm run e2e`；改了在线曲谱转换器再跑 `npm run e2e:songs`。
- e2e 的各项检查共用一个页面，前一项留下的状态会带到后面：前一项失败时，先看它，后面的失败可能是连带的。
- e2e 涉及谱面的预期要从谱子本身算，不要写死；它会向在线曲谱网站发少量请求。
- 截图和测试输出是临时产物，不进版本库。

## 先问用户再做

- 调整界面（布局、交互、视觉、按钮）、改用户定下的做法。
- 加依赖或升级依赖。
- 提交：未经允许不提交；允许时直接提交到 main，提交信息干净简练，符合git提交规范；不加 `Co-Authored-By` 之类的署名行。
- 会碰到项目以外的东西：共用的 Python 环境、用户的个人文件、外部服务。
