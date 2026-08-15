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
- **永久插件形态**：写入 DSH 组成（`cordis.patch.yml`），随 DSH 启动自动加载，一次安装全局生效；
  同时保留动态插件源码（`src/`）作为会话级安装的替代方式

## 🖥 平台支持与已知限制

| 部分 | macOS | Windows / Linux |
| --- | --- | --- |
| 界面动图 + 进度条（纯 Web） | ✅ 已实测 | ⚠️ 理论可用，**未测试** |
| 完成提示音（宿主系统命令播放） | ✅ 已实测（`afplay`） | ⚠️ 命令已预留，**未测试** |

- 本插件在 **macOS** 上开发并实测；**Windows 与 Linux 目前没有环境测试**，
  如在两个平台上遇到问题，欢迎提 issue / 反馈。
- 界面部分基于 DSH Web 界面与标准浏览器能力实现，理论上跨平台一致。
- 提示音部分依赖宿主进程的系统播放命令，与操作系统强相关：
  - Windows：需在组成行 `config.playCommand` 换成 PowerShell 方案（代码注释已给出示例），**未经实测**；
  - Linux：可用 `ffplay -nodisp -autoexit`（需先安装 ffmpeg），**未经实测**。
- 若在 Windows/Linux 上提示音无法播放：可把 `config.playVoiceAtDone` 设为 `false`
  关闭音效（不影响动图进度条），或自行验证并替换 `playCommand`。

## 🗂 项目结构

```
YouAreSoBeautiful/
├── lib/
│   ├── host.js            # 永久插件 Host 半：素材路由 + agents 轮询播放提示音
│   └── client.js          # 永久插件 Client 半：client bundle（深潜区块 UI + 进度动画）
├── assets/
│   ├── spritesheet.webp   # 坤宠精灵图（8 列 × 9 行图集）
│   └── voice.mp3          # 完成提示音「你干嘛~哎哟」（100% 时由宿主进程系统级播放）
├── src/
│   ├── host.js            # 动态插件 Host 半（会话级安装的替代方式）
│   └── client.js          # 动态插件 Client 半
├── demo/
│   └── index.html         # 无需 DSH 的独立预览：可播放/暂停/拖动进度
├── docs/
│   ├── SPRITESHEET-CONTRACT.md  # 精灵图契约
│   └── PROGRESS-STAGES.md       # 进度档位与曲线说明
├── scripts/
│   ├── build-package.mjs  # 生成动态插件一键安装载荷
│   └── validate.mjs       # 仓库完整性校验
├── beauty.package.json    # 动态插件安装载荷
├── package.json           # 插件包清单（main / exports / dsh.client）
└── README.md
```

## 🚀 安装（永久插件，推荐）

永久插件写入 DSH 的 profile 组成，**随 DSH 启动自动加载**，所有会话生效。

### 第 1 步：获取本包

```bash
git clone <本仓库地址> && cd YouAreSoBeautiful
```

### 第 2 步：把包安装进你的 profile

DSH 官方命令 `dsh plugin` 会把参数转发给 profile 目录下的 pnpm：

```bash
dsh plugin add <本仓库绝对路径>
# 例：dsh plugin add /Users/you/YouAreSoBeautiful
```

或手动操作（与上面等价）：编辑 `$DSH_HOME/profiles/web/package.json`，在
`dependencies` 里加入：

```json
{ "dependencies": { "dsh-beauty-dive-progress": "file:/Users/you/YouAreSoBeautiful" } }
```

然后在 profile 目录执行 `pnpm install`。

### 第 3 步：在组成里插入插件行

编辑 `$DSH_HOME/profiles/web/cordis.patch.yml`，在数组里插入：

```yaml
- insert:
    - id: beauty-dive-progress
      name: dsh-beauty-dive-progress
      config:
        playVoiceAtDone: true
        # 素材默认取包内 assets/，一般无需配置；如需自定义：
        # spritePath: /绝对路径/spritesheet.webp
        # voicePath: /绝对路径/voice.mp3
        # playCommand: (p) => "ffplay -nodisp -autoexit '" + p + "'"
```

### 第 4 步：重启 DSH

```bash
# 停止当前 dsh web 进程，再重新启动：
dsh web
```

> 部分部署会热重载 `cordis.patch.yml`，但**新插件的首次加载以重启为准**。
> 重启后浏览器刷新一次页面。

### 第 5 步：验证

```bash
# 素材路由（应为 image/webp）
curl -sI http://127.0.0.1:3080/beauty-dive/spritesheet.webp
# 客户端 bundle 路由（应返回 JS 源码）
curl -s http://127.0.0.1:3080/plugins/dsh-beauty-dive-progress/client.js
```

之后每次 DSH 回答问题的 Deep diving 期间，「Deep diving...」下方区块即出现坤宠进度条，
完成时播放「你干嘛~哎哟」。

## 🔛 启用 / 停用（enable / disable）

插件行里预置了一行**注释掉的开关**，停用只需去掉注释：

```yaml
- insert:
    - id: beauty-dive-progress
      name: dsh-beauty-dive-progress
      # ── 停用本插件：去掉下面这行前面的 "#" 注释 ──
      # ── 重新启用：再把 "#" 加回行首 ──
      # disabled: true
      config:
        playVoiceAtDone: true
```

**停用**：删除 `# disabled: true` 行首的 `#`；**启用**：把 `#` 加回去。
改完重启 `dsh web` 生效（支持热重载的部署会自动生效，重启最稳妥）。
停用后界面区块与提示音都立即消失，不影响 DSH 其它功能。

## 🗑 卸载（uninstall）

1. 从 `cordis.patch.yml` 中删除整个 `insert:` 段（含 `beauty-dive-progress` 行）；
2. 移除包依赖（二选一）：

   ```bash
   dsh plugin remove dsh-beauty-dive-progress
   # 或手动：编辑 $DSH_HOME/profiles/web/package.json 删除该依赖，再 pnpm install
   ```

3. 重启 `dsh web`。

## 🔄 更新（update）

```bash
cd <仓库目录> && git pull
dsh plugin add <仓库目录>   # 重新链接（内容随源码实时生效）
# 重启 dsh web
```

## 🧪 临时安装（动态插件，会话级）

不写组成、只在**当前会话**生效（进程重启后需重新安装）。适合试用：

1. 修改 `src/host.js` 顶部 `CONFIG` 的素材绝对路径（或保持默认）
2. `node scripts/build-package.mjs` 生成 `beauty.package.json`
3. 把载荷交给 DSH 会话里的 Agent 用 `cordis_define` + `cordis_run` 安装，或手动调用
4. 移除：`cordis_undefine`（或让会话结束自动消失）

> ⚠️ 动态插件与永久插件**不要同时启用**：两者注册同一条素材路由会冲突。

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

**永久插件**：全部配置在 `cordis.patch.yml` 的插件行 `config` 里（见上文），
支持 `spritePath` / `voicePath` / `routePath` / `playVoiceAtDone` / `pollMs` /
`playCooldownMs` / `playCommand`，素材默认取包内 `assets/`。

**动态插件**：`src/host.js` 顶部 `CONFIG`，以及 `src/client.js` 的 `STAGES`
（每档文案/动作）与 `MODEL`（自适应进度模型全部参数）。

**界面常量**（两种形态共用）：`lib/client.js` / `src/client.js` 的
`STAGES` / `MODEL` / `DONE_HOLD_MS`。

## 🧰 校验与测试

```bash
node scripts/validate.mjs        # 素材、双形态源码、载荷完整性校验
node scripts/build-package.mjs   # 重新生成动态插件载荷
npm run demo                     # 或 npx serve . 打开 demo/index.html 离线预览
```

## 🛟 故障排查

| 现象 | 排查 |
| --- | --- |
| 重启后 DSH 报插件行激活失败 | 确认第 2 步依赖已安装：profile 目录下 `node -e "require('dsh-beauty-dive-progress')"` 应成功 |
| 区块不显示但路由正常 | 浏览器强刷（Cmd+Shift+R）；确认没有同时启用动态插件 |
| 提示音不响 | 检查 `config.playVoiceAtDone`；macOS 用 `afplay`，其它系统按注释换 `playCommand` |
| 想让插件不加载 | 插件行加 `disabled: true` 后重启（见「启用/停用」） |

## 📄 License

MIT
