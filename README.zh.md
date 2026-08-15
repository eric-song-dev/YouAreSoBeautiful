# 🐤 dsh-ikun-pet · ikun 桌宠

[![DSH Plugin](https://img.shields.io/badge/DSH-plugin-4d6bfe?style=flat-square&logo=deepseek)](https://github.com/eric-song-dev/dsh-ikun-pet)
[![License](https://img.shields.io/github/license/eric-song-dev/dsh-ikun-pet?style=flat-square)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/eric-song-dev/dsh-ikun-pet?style=flat-square&logo=github)](https://github.com/eric-song-dev/dsh-ikun-pet/stargazers)
[![npm](https://img.shields.io/npm/v/dsh-ikun-pet?style=flat-square&logo=npm)](https://www.npmjs.com/package/dsh-ikun-pet)
[![Downloads](https://img.shields.io/npm/dm/dsh-ikun-pet?style=flat-square)](https://www.npmjs.com/package/dsh-ikun-pet)

![demo](docs/demo.gif)

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

## 🚀 安装

**方式 A：克隆安装**（适合想魔改的人）

```bash
git clone https://github.com/eric-song-dev/dsh-ikun-pet && cd dsh-ikun-pet
dsh plugin add "$PWD" --profile web
```

**方式 B：远程一条命令**（适合纯使用者）

```bash
dsh plugin add github:eric-song-dev/dsh-ikun-pet --profile web
# 或：dsh plugin add https://github.com/eric-song-dev/dsh-ikun-pet.git --profile web
```

**方式 C：npm 一条命令**（预构建安装，免 allowBuilds 构建授权）

```bash
dsh plugin add dsh-ikun-pet --profile web
```

> 💡 如果你的 profile 名不是 `web`，把上面命令里的 `--profile web` 换成你的 profile 名。

装完重启 `dsh web`，浏览器刷新即可。验证：

```bash
curl -sI http://127.0.0.1:3080/ikun-pet/spritesheet.webp   # 素材路由（应为 image/webp）
curl -s  http://127.0.0.1:3080/plugins/dsh-ikun-pet/client.js   # client bundle（应返回 JS）
```

## 🎬 档位 → 动作 → 文案

| 进度 | 动图动作 | 文案 |
| ---: | --- | --- |
| 0% – 20% | waiting（期待） | 深潜启动！准备出发… |
| 20% – 40% | runRight（向右跑） | 正在收集线索… |
| 40% – 60% | working（专注干活） | 埋头苦干中… |
| 60% – 80% | review（思考审阅） | 认真思考中… |
| 80% – 100% | wave（挥手） | 快好啦！马上见结果~ |
| 100%（完成） | jump（跳跃庆祝） | 完成啦！你干嘛~哎哟 🔉（宿主进程播放提示音） |

## ⚙️ 配置（可选）

全部配置在包内 `cordis.patch.yml` 插件行的 `config` 里：`spritePath` / `voicePath` /
`playVoiceAtDone` / `playCommand`（素材默认取包内 `assets/`）。

- **停用插件**：把 `# disabled: true` 行首的 `#` 去掉，重启 `dsh web`（再加回 `#` 即重新启用）
- **关闭音效**：`config.playVoiceAtDone: false`（不影响动图进度条）
- **Windows/Linux 提示音**：把 `playCommand` 换成 PowerShell / ffplay 方案（注释里有示例；macOS 默认 `afplay` 已实测）

## 🗑 卸载 / 🔄 更新

```bash
dsh plugin remove dsh-ikun-pet --profile web     # 卸载（bundles 层自动对账），然后重启 dsh web
# 更新：cd <仓库目录> && git pull && dsh plugin add "$PWD" --profile web
```

## 🧪 临时安装（动态插件，会话级）

```bash
node scripts/build-package.mjs     # 生成 ikun.package.json 一键安装载荷
```

把载荷交给 Agent 用 `cordis_define` + `cordis_run` 安装，仅当前会话生效。
⚠️ 与永久插件**不要同时启用**（同一条素材路由会冲突）。

## 🖥 平台支持

| 部分 | macOS | Windows / Linux |
| --- | --- | --- |
| 界面动图 + 进度条（纯 Web） | ✅ 已实测 | ⚠️ 理论可用，未测试 |
| 完成提示音（系统命令播放） | ✅ 已实测（`afplay`） | ⚠️ 命令已预留，未测试 |

## 🛟 故障排查

| 现象 | 排查 |
| --- | --- |
| 重启后插件行激活失败 | profile 目录下 `node -e "require('dsh-ikun-pet')"` 应成功，失败则重装 |
| 区块不显示但路由正常 | 浏览器强刷（Cmd+Shift+R）；确认没有同时启用动态插件 |
| 提示音不响 | 检查 `config.playVoiceAtDone`；macOS 用 `afplay`，其它系统换 `playCommand` |
| 想让插件不加载 | 插件行加 `disabled: true` 后重启 |

## 📄 License

MIT
