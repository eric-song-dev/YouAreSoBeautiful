# Changelog

## 2.0.0（2025-08-15）

- 升级为**永久插件**：可写入 DSH 组成（`cordis.patch.yml`），随 DSH 启动自动加载，无需每次会话重新激活
  - 新增 `lib/host.js`（Host 半）：webServer 素材路由 + 轮询 agents 系统级播放完成提示音；素材默认取包内 `assets/`，路径与播放命令可经组成行 `config` 覆盖
  - 新增 `lib/client.js`（Client 半）：手写 client bundle（`__ModuleLoader__` 契约），通过 `package.json` 的 `dsh.client` + `exports["./client"]` 声明被 dsh-client-modules 扫描加载；goal 进度改由会话投影 `useProjection('goal')` 客户端直读，无需 RPC
  - `package.json` 升级为插件包清单（main / exports / dsh.client）
- `src/` 动态插件源码与载荷保留，作为会话级安装的替代方式
- README 新增永久插件的安装 / 卸载 / 启用 / 停用完整教程

## 1.2.0（2025-08-15）

- 进度策略升级为**通用自适应模型**（替换固定时间常数曲线）：
  - 真实信号：goal 模式按 `已进行回合数 / 目标回合上限` 贡献真实进度（新增 `beauty-dive-goal` RPC）
  - 自适应预期：取本会话最近 8 个回合时长的中位数自校准，短任务快跑、长任务慢跑
  - 活动调速：工具执行 ×1.8、流式输出 ×1.2、等待用户审批/回答 ×0.05
  - 收缩保留量：封顶 88% 起、越跑越久越接近 98%，永不假 100%
  - 所有参数集中在 `src/client.js` 的 `MODEL` 常量

## 1.1.1（2025-08-15）

- 文档：README 新增「平台支持与已知限制」章节 —— 明确 Windows / Linux
  未测试（界面部分理论可用，提示音系统命令需自行替换并验证）

## 1.1.0（2025-08-15）

- 新增完成提示音：深潜完成（100%）时由宿主进程系统级播放 `assets/voice.mp3`
  （「你干嘛~哎哟」，默认 macOS `afplay`，可用 `CONFIG.playVoiceAtDone` /
  `playCommand` 配置开关与播放器）
- `beauty_dive_debug` 增加语音状态字段（voiceExists / playCount / lastPlayError）
- demo 页完成按钮同步播放提示音

## 1.0.0（2025-08-15）

- 首次发布：DSH 深潜进度桌宠
  - 注册 `conversation.input.dock`，仅在 Deep diving（会话 running）期间渲染
  - 坤宠动图沿进度条行走，0% → 100%，每 20% 切换动作与文案
  - 完成时跳跃庆祝「完成啦！你干嘛~哎哟」，1.8s 后退场
  - Host 通过 `webServer` 提供本地精灵图；`beauty_dive_debug` 调试工具
  - 独立 demo 页与构建/校验脚本
