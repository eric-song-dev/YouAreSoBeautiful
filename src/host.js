// =============================================================================
// dsh-ikun-pet · ikun 桌宠（Host 半）
// 用于 DSH 的 cordis_define 工具：code.host 字段
//
// 职责：
//   1. 读取本地素材（坤宠精灵图），通过 webServer 注册 HTTP 路由给浏览器加载
//   2. 提供 ikun-pet-state RPC：返回精灵图 URL（客户端挂载时拉取一次）
//   3. 深潜完成（100%）时由宿主进程用系统命令播放「你干嘛~哎哟」提示音
//   4. 提供 ikun_pet_debug 调试工具：查看素材加载、路由与播放状态
//
// 安装：见 README.md「安装」章节
// =============================================================================

// ===== 配置区（按需修改） =====
const CONFIG = {
  // 精灵图路径（8 列 × 9 行、每格 192×208 的 WebP，见 docs/SPRITESHEET-CONTRACT.md）
  spritePath: '/Users/ericsong/test/project/dsh/dsh-ikun-pet/assets/spritesheet.webp',
  // 素材路由路径（webServer 的 HTTP pathname，需全局唯一、勿与其它插件冲突）
  routePath: '/ikun-pet/spritesheet.webp',
  // 完成提示音路径（mp3）
  voicePath: '/Users/ericsong/test/project/dsh/dsh-ikun-pet/assets/voice.mp3',
  // 是否在深潜完成（100%）时播放提示音
  playVoiceAtDone: true,
  // 宿主进程系统级播放命令（macOS 用 afplay；Windows 可用 powershell -c (New-Object Media.SoundPlayer '...').PlaySync()；Linux 可用 ffplay -nodisp -autoexit）
  playCommand: (path) => "afplay '" + path.replace(/'/g, "'\\''") + "'",
}

return {
  apply(ctx) {
    const fs = ctx.get('fs')
    const webServer = ctx.get('webServer')
    if (fs === undefined || webServer === undefined) {
      console.error('[ikun-pet] fs or webServer service is unavailable')
      return
    }

    // ---------- 一次性加载本地素材 ----------
    let spriteBytes = null
    let spriteUrl = null
    let voiceExists = false
    let disposed = false
    let playCount = 0
    let lastPlayError = null
    let lastGoal = null
    const routeDisposers = []

    const loadAssets = async () => {
      try {
        const target = await fs.resolve(CONFIG.spritePath)
        spriteBytes = await fs.readBytes(target, undefined, 16 * 1024 * 1024)
        console.log('[ikun-pet] spritesheet loaded:', spriteBytes.length, 'bytes')
      } catch (err) {
        console.error('[ikun-pet] failed to load spritesheet:', err)
      }
      try {
        const target = await fs.resolve(CONFIG.voicePath)
        const info = await fs.stat(target)
        voiceExists = info !== undefined
        if (voiceExists) console.log('[ikun-pet] voice ready:', CONFIG.voicePath)
        else console.warn('[ikun-pet] voice file not found:', CONFIG.voicePath)
      } catch (err) {
        voiceExists = false
        console.error('[ikun-pet] failed to stat voice:', err)
      }
      if (disposed || spriteBytes === null) return

      // 注册素材 HTTP 路由，浏览器侧直接通过 <url> 加载动图
      routeDisposers.push(webServer.register({
        kind: 'exact',
        path: CONFIG.routePath,
        handler: (_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'image/webp',
            'Content-Length': String(spriteBytes.length),
            'Cache-Control': 'public, max-age=86400',
          })
          res.end(spriteBytes)
        },
      }))
      try {
        const host = webServer.host === '0.0.0.0' ? '127.0.0.1' : webServer.host
        spriteUrl = 'http://' + host + ':' + webServer.port + CONFIG.routePath
      } catch (err) {
        console.error('[ikun-pet] failed to build sprite URL:', err)
      }
    }
    const assetsReady = loadAssets()

    // ---------- 生命周期：停止/更新时移除路由 ----------
    ctx.effect(() => () => {
      disposed = true
      for (const dispose of routeDisposers) dispose()
    })

    // ---------- 完成提示音：宿主进程系统级播放（与浏览器静音无关） ----------
    const playVoice = () => {
      if (!CONFIG.playVoiceAtDone) return { played: false, reason: 'disabled' }
      if (!voiceExists) return { played: false, reason: 'voice file missing' }
      const shell = ctx.get('shell')
      if (shell === undefined) {
        lastPlayError = 'shell service unavailable'
        return { played: false, reason: lastPlayError }
      }
      try {
        const spec = shell.resolve({ command: CONFIG.playCommand(CONFIG.voicePath) })
        playCount++
        lastPlayError = null
        shell.run(spec).catch((err) => {
          lastPlayError = String(err && err.message ? err.message : err)
          console.error('[ikun-pet] voice playback failed:', err)
        })
        return { played: true }
      } catch (err) {
        lastPlayError = String(err && err.message ? err.message : err)
        console.error('[ikun-pet] failed to start voice playback:', err)
        return { played: false, reason: lastPlayError }
      }
    }

    // ---------- client RPC：返回素材地址 ----------
    harness.handle('ikun-pet-state', async () => {
      await assetsReady
      return { spriteUrl }
    })

    // ---------- client RPC：深潜完成（100%）时触发提示音 ----------
    harness.handle('ikun-pet-voice', async () => {
      await assetsReady
      return playVoice()
    })

    // ---------- client RPC：查询会话目标回合进度（真实信号，goal 模式开启时可用） ----------
    harness.handle('ikun-pet-goal', async (args) => {
      const agents = ctx.get('agents')
      const goals = ctx.get('goals')
      if (agents === undefined || goals === undefined) return { goal: null }
      if (args === null || typeof args !== 'object' || typeof args.sessionId !== 'string') return { goal: null }
      try {
        const agent = agents.get(args.sessionId)
        if (agent === undefined) return { goal: null }
        const view = goals.get(agent)
        if (view === undefined || typeof view.maxGoalRounds !== 'number' || typeof view.roundsStarted !== 'number') return { goal: null }
        if (view.maxGoalRounds <= 0 || view.phase !== 'active') return { goal: null }
        lastGoal = {
          roundsStarted: view.roundsStarted,
          maxGoalRounds: view.maxGoalRounds,
          phase: String(view.phase),
        }
        return { goal: lastGoal }
      } catch (err) {
        return { goal: null }
      }
    })

    // ---------- 调试工具 ----------
    harness.registerTool(ctx, harness.defineTool({
      name: 'ikun_pet_debug',
      description: 'Read the dsh-ikun-pet deep-dive progress plugin state: asset loading, HTTP route and sprite URL. Use only to diagnose the deep-dive progress pet.',
      parameters: {},
      output: {
        schema: { type: 'json' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      execute() {
        return Promise.resolve({
          spriteLoaded: spriteBytes !== null,
          spriteBytes: spriteBytes !== null ? spriteBytes.length : 0,
          spriteUrl,
          routePath: CONFIG.routePath,
          spritePath: CONFIG.spritePath,
          voicePath: CONFIG.voicePath,
          playVoiceAtDone: CONFIG.playVoiceAtDone,
          voiceExists,
          playCount,
          lastPlayError,
          lastGoal,
        })
      },
    }))
  },
}
