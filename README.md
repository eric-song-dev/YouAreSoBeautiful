# 🐤 You Are So Beautiful · 深潜进度桌宠

> DeepSeek Harness（DSH）插件 —— 只在 DSH **每次回答问题的 Deep diving 期间**，
> 用坤宠动图**填满「Deep diving...」状态行下方的整行区块**：
> 进度条 `0% → 100%`，**每 20% 切换一档动图动作与文案**，完成时跳跃庆祝「完成啦！你干嘛~哎哟」🏀

## ✨ 特性

- **只占深潜区块**：注册在 `conversation.input.dock` —— 正是 DSH「Deep diving...」状态行正下方、
  对话区与输入框之间的整行区块；仅在会话 `running`（深潜回答）时出现，其余时间完全隐形
- **动图沿进度条行走**：坤宠从 3% 走到 97%，压着进度条逐帧播放（8 列 × 9 行精灵图契约）
- **每 20% 一档**：0/20/40/60/80/100 六档分别切换动图动作与文案（见 [docs/PROGRESS-STAGES.md](docs/PROGRESS-STAGES.md)）
- **通用自适应进度**：分层估算模型——真实锚点（开始 0% / 完成 100%）＋
  goal 回合真实进度＋本会话历史回合时长自校准＋工具/流式/等待审批动态调速＋收缩保留量；
  短任务快跑、长任务慢跑，等待你审批时诚实减速，永不假 100%（详见 [docs/PROGRESS-STAGES.md](docs/PROGRESS-STAGES.md)）
- **完成全机可闻**：100% 完成时由宿主进程用系统命令播放「你干嘛~哎哟」（`assets/voice.mp3`），
  任何窗口、任何会话完成都听得到，与浏览器静音无关（已在 macOS 实测）
- **零轮询**：直接消费 DSH 插槽自带的 `useSession` 快照读取 `running` 与回合开始时间，
  Host 只负责把本地精灵图通过 `webServer` 提供给浏览器
- **主题自适应**：全部颜色使用 DSH 主题变量（`--dsw-alias-*`），深浅色模式自动适配
- **内置调试工具**：`beauty_dive_debug` 可查看素材加载、HTTP 路由与精灵图 URL

## 🖥 平台支持与已知限制

| 部分 | macOS | Windows / Linux |
| --- | --- | --- |
| 界面动图 + 进度条（纯 Web） | ✅ 已实测 | ⚠️ 理论可用，**未测试** |
| 完成提示音（宿主系统命令播放） | ✅ 已实测（`afplay`） | ⚠️ 命令已预留，**未测试** |

- 本插件在 **macOS** 上开发并实测；**Windows 与 Linux 目前没有环境测试**，
  如在两个平台上遇到问题，欢迎提 issue / 反馈。
- 界面部分基于 DSH Web 界面与标准浏览器能力实现，理论上跨平台一致。
- 提示音部分依赖宿主进程的系统播放命令，与操作系统强相关：
  - Windows：需在 `src/host.js` 的 `CONFIG.playCommand` 换成 PowerShell 方案
    （代码注释已给出示例），**未经实测**；
  - Linux：可用 `ffplay -nodisp -autoexit`（需先安装 ffmpeg），**未经实测**。
- 若在 Windows/Linux 上提示音无法播放：可把 `CONFIG.playVoiceAtDone` 设为 `false`
  关闭音效（不影响动图进度条），或自行验证并替换 `playCommand`。

## 🗂 项目结构

```
YouAreSoBeautiful/
├── assets/
│   ├── spritesheet.webp   # 坤宠精灵图（8 列 × 9 行图集）
│   └── voice.mp3          # 完成提示音「你干嘛~哎哟」（100% 时由宿主进程系统级播放）
├── demo/
│   └── index.html         # 无需 DSH 的独立预览：可播放/暂停/拖动进度
├── docs/
│   ├── SPRITESHEET-CONTRACT.md  # 精灵图契约
│   └── PROGRESS-STAGES.md       # 进度档位与曲线说明
├── scripts/
│   ├── build-package.mjs  # 生成 cordis_define 一键安装载荷
│   └── validate.mjs       # 仓库完整性校验
├── src/
│   ├── host.js            # 插件 Host 半：素材路由 + RPC + 调试工具
│   └── client.js          # 插件 Client 半：深潜区块 UI + 进度动画
├── beauty.package.json    # 生成的安装载荷（可直接粘贴给 cordis_define）
├── package.json
└── README.md
```

## 🚀 安装

### 方式一：DSH 动态插件（推荐）

本插件以 **DSH 动态插件** 形式开发并运行验证。在 DSH 会话里让 Agent 执行，或手动调用 `cordis_define` 工具：

1. 克隆本仓库（或直接把本目录作为工作区）
2. 修改 `src/host.js` 顶部 `CONFIG.spritePath` 为你的绝对路径：

   ```js
   const CONFIG = {
     spritePath: '/你的/路径/YouAreSoBeautiful/assets/spritesheet.webp',
     routePath: '/beauty-dive/spritesheet.webp',
   }
   ```

3. 生成一键安装载荷并粘贴给 `cordis_define` 工具：

   ```bash
   node scripts/build-package.mjs   # 生成 beauty.package.json
   ```

   载荷结构（`kind: "new"` 创建新插件；后续更新用 `kind: "existing"` + `pluginId`）：

   ```json
   {
     "plugin": { "kind": "new", "idPrefix": "beauty" },
     "name": "You Are So Beautiful · 深潜进度桌宠",
     "purpose": "在 DSH 每次回答问题的 Deep diving 期间，用坤宠动图填满深潜状态行下方的区块：进度条 0%→100%，每 20% 切换动作与文案，完成时播放「完成啦！你干嘛~哎哟」。",
     "code": { "host": "<src/host.js 内容>", "client": "<src/client.js 内容>" }
   }
   ```

4. 用 `cordis_run` 激活。之后每当 DSH 回答问题的 Deep diving 期间，「Deep diving...」下方区块即出现坤宠进度条。

### 方式二：直接预览动画（无需 DSH）

打开 `demo/index.html`（建议起个静态服务器，如 `npx serve .` 或 `python3 -m http.server`），
即可播放/暂停/拖动进度，预览六档动作与文案。

## 🎬 档位 → 动作 → 文案

| 进度 | 动图动作 | 文案 |
| ---: | --- | --- |
| 0% – 20% | waiting（期待） | 深潜启动！准备出发… |
| 20% – 40% | runRight（向右跑） | 正在收集线索… |
| 40% – 60% | working（专注干活） | 埋头苦干中… |
| 60% – 80% | review（思考审阅） | 认真思考中… |
| 80% – 100% | wave（挥手） | 快好啦！马上见结果~ |
| 100%（完成） | jump（跳跃庆祝） | 完成啦！你干嘛~哎哟 🔉（宿主进程播放提示音） |

进度曲线与全部可调参数详见 [docs/PROGRESS-STAGES.md](docs/PROGRESS-STAGES.md)。

## ⚙️ 配置

所有可调项集中在两处：

- `src/host.js` 顶部 `CONFIG`：精灵图本地路径、HTTP 路由路径、提示音路径
  （`voicePath`）、完成是否播放（`playVoiceAtDone`）与系统播放命令
  （`playCommand`，macOS 默认 `afplay` 已实测；Windows/Linux 请按注释替换，
  未测试，详见上方「平台支持与已知限制」）
- `src/client.js` 的 `STAGES`（每档文案/动作）、`MODEL`（通用自适应进度模型全部参数：
  历史记忆条数、默认/最小预期时长、调速倍率、保留量、goal 轮询间隔）、`DONE_HOLD_MS`（完成停留时长）

## 🧰 校验与测试

```bash
node scripts/validate.mjs   # 素材、源码、载荷完整性校验
node scripts/build-package.mjs  # 重新生成安装载荷
```

## 📄 License

MIT
