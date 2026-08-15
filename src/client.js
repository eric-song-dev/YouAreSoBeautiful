// =============================================================================
// dsh-ikun-pet · ikun 桌宠（Client 半）
// 用于 DSH 的 cordis_define 工具：code.client 字段
//
// 职责：
//   1. 注入 conversation.input.dock 插槽 —— 即 DSH「Deep diving...」状态行
//      正下方的整行区块（对话区与输入框之间），仅在会话 running（深潜）时出现
//   2. 渲染坤宠动图 + 进度条：0% → 100% 平滑推进，宠物沿进度条行走；
//      进度用通用自适应模型估算（真实锚点 + goal 回合真实进度 +
//      会话历史时长自校准 + 工具/流式/等待活动调速 + 收缩保留量）
//   3. 每 20% 切换一档：动图动作与气泡文案同时变化（0/20/40/60/80/100）
//   4. 深潜完成后播放庆祝动画（100% + 「完成啦！你干嘛~哎哟」）再退场，
//      并通过 ikun-pet-voice RPC 让宿主进程系统级播放完成提示音
// =============================================================================

return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`
.ikun-pet {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 14px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  animation: ikun-pet-in 0.18s ease-out;
}
@keyframes ikun-pet-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}
.ikun-pet-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 2px;
}
.ikun-pet-text {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ikun-pet-pct {
  flex: none;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-brand-primary);
  font-variant-numeric: tabular-nums;
}
.ikun-pet-stage {
  position: relative;
  height: 58px;
}
.ikun-pet-pet {
  position: absolute;
  bottom: 0;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 2;
}
.ikun-pet-sprite {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
.ikun-pet-emoji {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}
.ikun-pet-track {
  position: relative;
  height: 8px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}
.ikun-pet-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 6px;
  background: var(--dsw-alias-brand-primary);
  transition: width 150ms linear;
}
.ikun-pet-fill::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: 6px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  background-size: 200% 100%;
  animation: ikun-pet-sheen 1.6s linear infinite;
}
.ikun-pet-fill-done {
  background: var(--dsw-alias-state-success-primary);
}
@keyframes ikun-pet-sheen {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ikun-pet { animation: none; }
  .ikun-pet-fill::after { animation: none; }
}
`)

    // ---- 精灵图契约：8 列 × 9 行、每格 192×208（见 docs/SPRITESHEET-CONTRACT.md）----
    const SCALE = 0.27
    const W = 192 * SCALE
    const H = 208 * SCALE

    // 每行一种动作：帧数 + 帧时长（ms），图集契约见 docs/SPRITESHEET-CONTRACT.md
    const ROWS = {
      waiting:  { row: 6, count: 6, frames: [150, 150, 150, 150, 150, 260] },
      runRight: { row: 1, count: 8, frames: [120, 120, 120, 120, 120, 120, 120, 220] },
      working:  { row: 7, count: 6, frames: [120, 120, 120, 120, 120, 220] },
      review:   { row: 8, count: 6, frames: [150, 150, 150, 150, 150, 280] },
      wave:     { row: 3, count: 4, frames: [140, 140, 140, 280] },
      jump:     { row: 4, count: 5, frames: [140, 140, 140, 140, 280] },
    }

    // ---- 进度档位：每 20% 一档，动作 + 文案同步切换 ----
    const STAGES = [
      { upTo: 20,  anim: 'waiting',  text: '深潜启动！准备出发…' },
      { upTo: 40,  anim: 'runRight', text: '正在收集线索…' },
      { upTo: 60,  anim: 'working',  text: '埋头苦干中…' },
      { upTo: 80,  anim: 'review',   text: '认真思考中…' },
      { upTo: 100, anim: 'wave',     text: '快好啦！马上见结果~' },
    ]
    const DONE_TEXT = '完成啦！你干嘛~哎哟'
    const DONE_HOLD_MS = 1800 // 100% 庆祝动画停留时长

    // ---- 通用自适应进度模型（v1.2，参数集中，按需调整） ----
    // 分层策略：真实锚点（0%/100%）→ 真实信号（goal 回合进度）→
    //           自适应预期时长（本会话历史中位数）→ 活动调速 → 收缩保留量
    const MODEL = {
      historySize: 8,           // 本会话回合时长记忆条数（取中位数，抗离群值）
      defaultExpectedMs: 45000, // 无历史数据时的默认回合预期时长
      minExpectedMs: 8000,      // 预期时长下限（防超短回合把曲线调得太陡）
      tauDivisor: 3,            // 曲线时间常数 tau = expected / 3
      reserveBasePct: 12,       // 起始“完成保留量”：开跑时进度封顶 88%
      reserveFloorPct: 2,       // 超长时间后保留量下限：封顶最多漂到 98%
      reserveTimeScale: 2,      // 保留量衰减：reserve = base × e^(−elapsed/(scale×expected))
      paceIdle: 1,              // 无活动：基准速度
      paceStreaming: 1.2,       // 模型正在流式输出：略快
      paceTools: 1.8,           // 有工具在执行：明显更快（工作密度高）
      paceWaiting: 0.05,        // 等待用户审批/回答：几乎停住（诚实）
      goalPollMs: 2000,         // 目标回合进度轮询间隔
    }
    const turnDurationHistory = [] // 插件生命周期内的回合时长记忆（跨回合、跨重挂载）

    function DiveProgress(props) {
      if (typeof props.useSession !== 'function') return null
      const useSession = props.useSession
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : null

      // 会话是否正在深潜（回答中）；深潜开始时间取当前打开回合的 turn/start
      const running = useSession((s) => s.running)
      const openTurnStart = useSession((s) => {
        const timings = s.turnTimings
        if (timings === undefined) return 0
        let latest = -1
        let start = 0
        let open = false
        for (const [turn, timing] of timings) {
          if (turn <= latest) continue
          latest = turn
          open = timing !== undefined && timing.endTime === undefined
          if (open && typeof timing.startTime === 'number') start = timing.startTime
        }
        return open ? start : 0
      })

      // ---- 活动信号（真实）：工具调用数 / 是否在流式输出 / 是否在等用户 ----
      const toolCount = useSession((s) => (Array.isArray(s.runningCalls) ? s.runningCalls.length : 0))
      const streaming = useSession((s) => s.partial !== null)
      const waitingOn = useSession((s) => (Array.isArray(s.pending) ? s.pending.length : 0))
      // 本会话已完成回合时长的中位数（自校准种子；无历史时为 0）
      const historySeed = useSession((s) => {
        const timings = s.turnTimings
        if (timings === undefined) return 0
        const durations = []
        for (const [, timing] of timings) {
          if (timing !== undefined && typeof timing.startTime === 'number' && typeof timing.endTime === 'number' && timing.endTime > timing.startTime) {
            durations.push(timing.endTime - timing.startTime)
          }
        }
        if (durations.length === 0) return 0
        durations.sort((a, b) => a - b)
        return durations[Math.floor(durations.length / 2)]
      })

      const [spriteUrl, setSpriteUrl] = React.useState(null)
      const [phase, setPhaseState] = React.useState('idle') // idle | diving | done
      const [progress, setProgress] = React.useState(0)
      const [goalPct, setGoalPct] = React.useState(null)
      const [frame, setFrame] = React.useState(0)
      const phaseRef = React.useRef('idle')
      const goalPctRef = React.useRef(null)
      const paceRef = React.useRef({ tools: 0, streaming: false, waiting: 0 })
      const seedRef = React.useRef(0)
      const diveStartRef = React.useRef(0)
      // 最新值经 ref 供定时器读取，避免重启计时器
      goalPctRef.current = goalPct
      paceRef.current = { tools: toolCount, streaming, waiting: waitingOn }
      seedRef.current = historySeed
      const setPhase = (next) => {
        phaseRef.current = next
        setPhaseState(next)
      }

      // 当前预期时长：优先本插件记忆的中位数，其次本会话历史种子，最后默认值
      const currentExpected = () => {
        if (turnDurationHistory.length >= 2) {
          const sorted = turnDurationHistory.slice().sort((a, b) => a - b)
          return sorted[Math.floor(sorted.length / 2)]
        }
        const seed = seedRef.current
        return seed > 0 ? seed : MODEL.defaultExpectedMs
      }

      // ---- 素材地址：Host 通过 webServer 提供本地 WebP ----
      React.useEffect(() => {
        let alive = true
        host.call('ikun-pet-state').then((s) => {
          if (alive && s !== null && typeof s.spriteUrl === 'string') setSpriteUrl(s.spriteUrl)
        }).catch(() => { /* 素材失败时使用 🐤 占位 */ })
        return () => { alive = false }
      }, [])

      // ---- 状态机：idle → diving → done → idle ----
      React.useEffect(() => {
        if (running) {
          if (phaseRef.current === 'idle' || phaseRef.current === 'done') {
            diveStartRef.current = openTurnStart > 0 ? openTurnStart : Date.now()
            setGoalPct(null)
            setProgress(0)
            setPhase('diving')
          }
        } else if (phaseRef.current === 'diving') {
          // 记录本回合真实时长，供后续回合自校准预期
          const duration = Date.now() - diveStartRef.current
          if (duration > 1500) {
            turnDurationHistory.push(duration)
            if (turnDurationHistory.length > MODEL.historySize) turnDurationHistory.shift()
          }
          setProgress(100)
          setPhase('done')
          // 完成：宿主进程系统级播放「你干嘛~哎哟」（与浏览器静音无关）
          host.call('ikun-pet-voice').catch(() => { /* 播放失败静默，宿主端已记录 */ })
          const stop = ctx.timeout(() => {
            setProgress(0)
            setPhase('idle')
          }, DONE_HOLD_MS)
          return () => { stop() }
        }
      }, [running, openTurnStart])

      // ---- 进度推进：通用自适应模型（真实锚点 + 自适应预期 + 活动调速 + 收缩保留量）----
      React.useEffect(() => {
        if (phase !== 'diving') return
        let alive = true
        let lastTick = Date.now()
        let workTime = 0
        let maxSeen = 0
        const startedAt = diveStartRef.current > 0 ? diveStartRef.current : Date.now()
        const expected = Math.max(MODEL.minExpectedMs, currentExpected())
        const tau = Math.max(3000, expected / MODEL.tauDivisor)

        const stop = ctx.interval(() => {
          if (!alive) return
          const now = Date.now()
          const dt = Math.min(1000, Math.max(0, now - lastTick))
          lastTick = now
          const elapsed = Math.max(0, now - startedAt)

          // 活动调速：等用户 ≈ 停住；工具执行 > 流式输出 > 空闲
          const pace = paceRef.current
          let rate = MODEL.paceIdle
          if (pace.waiting > 0) rate = MODEL.paceWaiting
          else if (pace.tools > 0) rate = MODEL.paceTools
          else if (pace.streaming) rate = MODEL.paceStreaming

          workTime += dt * rate
          const timeP = 100 * (1 - Math.exp(-workTime / tau))
          const goalP = goalPctRef.current !== null ? goalPctRef.current : 0
          // 收缩的完成保留量：正常封顶 ~88%，跑得越久越接近 100%，但永不假 100%
          const reserve = Math.max(MODEL.reserveFloorPct, MODEL.reserveBasePct * Math.exp(-elapsed / (MODEL.reserveTimeScale * expected)))
          const cap = 100 - reserve
          const next = Math.min(cap, Math.max(timeP, goalP))
          maxSeen = Math.max(maxSeen, next)
          setProgress((prev) => {
            const rounded = Math.floor(maxSeen * 10) / 10
            return Math.abs(rounded - prev) < 0.1 ? prev : rounded
          })
        }, 200)
        return () => {
          alive = false
          stop()
        }
      }, [phase])

      // ---- 目标回合进度：真实信号轮询（goal 模式开启时优先贡献进度）----
      React.useEffect(() => {
        if (phase !== 'diving' || sessionId === null) return
        let alive = true
        const poll = () => {
          host.call('ikun-pet-goal', { sessionId }).then((r) => {
            if (!alive || r === null || r.goal === null) return
            const g = r.goal
            if (typeof g.roundsStarted !== 'number' || typeof g.maxGoalRounds !== 'number' || g.maxGoalRounds <= 0) return
            setGoalPct(Math.min(99, (g.roundsStarted / g.maxGoalRounds) * 100))
          }).catch(() => { /* 目标服务不可用时静默降级 */ })
        }
        poll()
        const stop = ctx.interval(poll, MODEL.goalPollMs)
        return () => {
          alive = false
          stop()
        }
      }, [phase, sessionId])

      // ---- 当前档位：动作 + 文案 ----
      let anim = ROWS.waiting
      let text = ''
      if (phase === 'done') {
        anim = ROWS.jump
        text = DONE_TEXT
      } else {
        let stage = STAGES[STAGES.length - 1]
        for (let i = 0; i < STAGES.length; i++) {
          if (progress < STAGES[i].upTo) {
            stage = STAGES[i]
            break
          }
        }
        anim = ROWS[stage.anim] || ROWS.waiting
        text = stage.text
      }

      // ---- 逐帧播放当前动作 ----
      React.useEffect(() => {
        let disposed = false
        let stopTimer = null
        const count = anim.count || 6
        const step = (i) => {
          if (disposed) return
          setFrame(i)
          const delay = (anim.frames && anim.frames[i]) || 150
          stopTimer = ctx.timeout(() => step((i + 1) % count), delay)
        }
        step(0)
        return () => {
          disposed = true
          if (stopTimer) stopTimer()
        }
      }, [anim])

      if (phase === 'idle') return null

      const pct = Math.round(progress)
      const col = frame % (anim.count || 6)
      const bgX = -(col * W)
      const bgY = -(anim.row * H)
      // 宠物中心沿面板 3% → 97% 行走，始终压在进度条上方
      const petLeft = (3 + progress * 0.94) + '%'

      return React.createElement('div', { className: 'ikun-pet', 'aria-hidden': 'true' },
        React.createElement('div', { className: 'ikun-pet-meta' },
          React.createElement('span', { className: 'ikun-pet-text', title: text }, text),
          React.createElement('span', { className: 'ikun-pet-pct' }, pct + '%'),
        ),
        React.createElement('div', { className: 'ikun-pet-stage' },
          React.createElement('div', {
            className: 'ikun-pet-pet',
            style: { left: petLeft, width: W + 'px', height: H + 'px' },
          },
            spriteUrl !== null
              ? React.createElement('div', {
                  className: 'ikun-pet-sprite',
                  style: {
                    backgroundImage: 'url("' + spriteUrl + '")',
                    backgroundSize: (W * 8) + 'px ' + (H * 9) + 'px',
                    backgroundPosition: bgX + 'px ' + bgY + 'px',
                  },
                })
              : React.createElement('div', { className: 'ikun-pet-emoji' }, '🐤'),
          ),
        ),
        React.createElement('div', { className: 'ikun-pet-track' },
          React.createElement('div', {
            className: 'ikun-pet-fill' + (phase === 'done' ? ' ikun-pet-fill-done' : ''),
            style: { width: progress + '%' },
          }),
        ),
      )
    }

    // ---- 注册到「Deep diving...」正下方的整行区块 ----
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'dsh-ikun-pet', order: 50, label: 'ikun 桌宠 · dsh-ikun-pet' },
      (props) => React.createElement(DiveProgress, props),
    ))
  },
}
