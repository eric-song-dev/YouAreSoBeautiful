// =============================================================================
// beauty-dive-progress · 深潜进度桌宠（Host 半 · 永久插件）
// 永久插件（写入 DSH 组成 cordis.patch.yml）的 Host 侧入口：
//
// 职责：
//   1. 读取精灵图（默认取包内 assets/），通过 webServer 注册 HTTP 路由给浏览器加载
//   2. 轮询 agents 服务：任一 Agent 从 running → idle（回合完成）时，
//      由宿主进程用系统命令播放「你干嘛~哎哟」提示音（与浏览器静音无关）
//   3. 全部路径与行为均可通过组成行 config 覆盖
//
// 安装/卸载/启停：见 README.md「永久插件」章节
// =============================================================================

'use strict'

const path = require('path')

// 默认配置：素材默认指向包内 assets/，部署到任何机器都无需改路径
const DEFAULTS = {
  // 精灵图路径（不填默认 <包>/assets/spritesheet.webp）
  spritePath: '',
  // 完成提示音路径（不填默认 <包>/assets/voice.mp3）
  voicePath: '',
  // 素材 HTTP 路由（与 lib/client.js 的 SPRITE_PATH 常量保持一致）
  routePath: '/beauty-dive/spritesheet.webp',
  // 是否在回合完成时播放提示音
  playVoiceAtDone: true,
  // agents 状态轮询间隔（毫秒）
  pollMs: 1000,
  // 两次播放之间的最小间隔（毫秒），防多会话接连完成时连响
  playCooldownMs: 2500,
  // 宿主进程系统级播放命令（macOS 用 afplay；Windows 可用 powershell -c (New-Object Media.SoundPlayer '...').PlaySync()；Linux 可用 ffplay -nodisp -autoexit）
  playCommand: (p) => "afplay '" + String(p).replace(/'/g, "'\\''") + "'",
}

module.exports = {
  inject: ['timer', 'webServer', 'fs'],
  apply(ctx, config) {
    const cfg = Object.assign({}, DEFAULTS, config || {})
    const assetsDir = path.join(__dirname, '..', 'assets')
    const spritePath = cfg.spritePath || path.join(assetsDir, 'spritesheet.webp')
    const voicePath = cfg.voicePath || path.join(assetsDir, 'voice.mp3')

    // ---------- 素材加载 + 路由 ----------
    let spriteBytes = null
    let voiceExists = false
    let disposed = false
    let lastPlayError = null
    let playCount = 0
    const routeDisposers = []

    const loadAssets = async () => {
      try {
        const target = await ctx.fs.resolve(spritePath)
        spriteBytes = await ctx.fs.readBytes(target, undefined, 16 * 1024 * 1024)
        console.log('[beauty-dive] spritesheet loaded:', spriteBytes.length, 'bytes')
      } catch (err) {
        console.error('[beauty-dive] failed to load spritesheet:', err)
      }
      try {
        const target = await ctx.fs.resolve(voicePath)
        const info = await ctx.fs.stat(target)
        voiceExists = info !== undefined
        if (voiceExists) console.log('[beauty-dive] voice ready:', voicePath)
        else console.warn('[beauty-dive] voice file not found:', voicePath)
      } catch (err) {
        voiceExists = false
        console.error('[beauty-dive] failed to stat voice:', err)
      }
      if (disposed || spriteBytes === null) return
      routeDisposers.push(ctx.webServer.register({
        kind: 'exact',
        path: cfg.routePath,
        handler: (_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'image/webp',
            'Content-Length': String(spriteBytes.length),
            'Cache-Control': 'public, max-age=86400',
          })
          res.end(spriteBytes)
        },
      }))
    }
    const assetsReady = loadAssets()

    ctx.effect(() => () => {
      disposed = true
      for (const dispose of routeDisposers) dispose()
    })

    // ---------- 完成提示音：宿主进程系统级播放 ----------
    const playVoice = () => {
      if (!cfg.playVoiceAtDone) return
      if (!voiceExists) return
      const shell = ctx.get('shell')
      if (shell === undefined) {
        lastPlayError = 'shell service unavailable'
        return
      }
      try {
        const spec = shell.resolve({ command: cfg.playCommand(voicePath) })
        playCount++
        lastPlayError = null
        shell.run(spec).catch((err) => {
          lastPlayError = String(err && err.message ? err.message : err)
          console.error('[beauty-dive] voice playback failed:', err)
        })
      } catch (err) {
        lastPlayError = String(err && err.message ? err.message : err)
        console.error('[beauty-dive] failed to start voice playback:', err)
      }
    }

    // ---------- 轮询 agents：running → idle 视为回合完成 ----------
    let anyRunning = false
    let lastPlayAt = 0
    const poll = () => {
      const agents = ctx.get('agents')
      if (agents === undefined) return
      let list
      try {
        list = agents.list()
      } catch (err) {
        return
      }
      if (!Array.isArray(list)) return
      let running = false
      for (const agent of list) {
        try {
          if (agent && agent.status === 'running') {
            running = true
            break
          }
        } catch (err) { /* ignore */ }
      }
      if (anyRunning && !running) {
        const now = Date.now()
        if (now - lastPlayAt >= cfg.playCooldownMs) {
          lastPlayAt = now
          playVoice()
        }
      }
      anyRunning = running
    }
    const stopPoll = ctx.interval(poll, cfg.pollMs)
    ctx.effect(() => stopPoll)
    // 预热：素材就绪后立即确认当前状态，避免把“启动即有 Agent 在跑”当成完成
    assetsReady.then(() => {
      const agents = ctx.get('agents')
      if (agents === undefined) return
      try {
        const list = agents.list()
        if (Array.isArray(list)) {
          for (const agent of list) {
            try {
              if (agent && agent.status === 'running') {
                anyRunning = true
                return
              }
            } catch (err) { /* ignore */ }
          }
        }
      } catch (err) { /* ignore */ }
    }).catch(() => {})
  },
}
