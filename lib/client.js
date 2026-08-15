// =============================================================================
// dsh-ikun-pet · ikun 桌宠（Client 半 · 永久插件）
// 永久插件（写入 DSH 组成 cordis.patch.yml）的 Client 侧入口：
// 由 dsh-client-modules 通过 package.json 的 dsh.client + exports["./client"]
// 扫描并作为 /plugins/<包名>/client.js 提供给浏览器。
//
// 职责：
//   1. 注入 conversation.input.dock 插槽 —— DSH「Deep diving...」状态行
//      正下方的整行区块，仅在会话 running（深潜）时出现
//   2. 渲染坤宠动图 + 进度条 0% → 100%：通用自适应模型（真实锚点 +
//      goal 回合真实进度[useProjection] + 会话历史时长自校准 +
//      工具/流式/等待活动调速 + 收缩保留量）
//   3. 每 20% 切换一档：动图动作与文案同步变化（0/20/40/60/80/100）
//   4. 完成音效由 Host 半轮询 agents 服务系统级播放（见 lib/host.js）
// =============================================================================

window.__ModuleLoader__.load({
  id: 'dsh-ikun-pet',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    // ---- 样式注入（与官方 client 包相同的 document.head 模式）----
    var CSS = `
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
`
    var CSS_TAG = 'dsh-ikun-pet/styles.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-ikun-pet'
      tag.dataset.pluginCss = CSS_TAG
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    // ---- 与 lib/host.js 的 CONFIG.routePath 保持一致 ----
    var SPRITE_PATH = '/ikun-pet/spritesheet.webp'

    // ---- 精灵图契约：8 列 × 9 行、每格 192×208 ----
    var SCALE = 0.27
    var W = 192 * SCALE
    var H = 208 * SCALE

    var ROWS = {
      waiting:  { row: 6, count: 6, frames: [150, 150, 150, 150, 150, 260] },
      runRight: { row: 1, count: 8, frames: [120, 120, 120, 120, 120, 120, 120, 220] },
      working:  { row: 7, count: 6, frames: [120, 120, 120, 120, 120, 220] },
      review:   { row: 8, count: 6, frames: [150, 150, 150, 150, 150, 280] },
      wave:     { row: 3, count: 4, frames: [140, 140, 140, 280] },
      jump:     { row: 4, count: 5, frames: [140, 140, 140, 140, 280] },
    }

    // ---- 进度档位：每 20% 一档，动作 + 文案同步切换 ----
    var STAGES = [
      { upTo: 20,  anim: 'waiting',  text: '深潜启动！准备出发…' },
      { upTo: 40,  anim: 'runRight', text: '正在收集线索…' },
      { upTo: 60,  anim: 'working',  text: '埋头苦干中…' },
      { upTo: 80,  anim: 'review',   text: '认真思考中…' },
      { upTo: 100, anim: 'wave',     text: '快好啦！马上见结果~' },
    ]
    var DONE_TEXT = '完成啦！你干嘛~哎哟'
    var DONE_HOLD_MS = 1800

    // ---- 通用自适应进度模型（参数集中，按需调整）----
    var MODEL = {
      historySize: 8,
      defaultExpectedMs: 45000,
      minExpectedMs: 8000,
      tauDivisor: 3,
      reserveBasePct: 12,
      reserveFloorPct: 2,
      reserveTimeScale: 2,
      paceIdle: 1,
      paceStreaming: 1.2,
      paceTools: 1.8,
      paceWaiting: 0.05,
    }
    var turnDurationHistory = []

    function DiveProgress(props) {
      if (typeof props.useSession !== 'function') return null
      var useSession = props.useSession
      var useProjection = typeof props.useProjection === 'function' ? props.useProjection : null

      var running = useSession((s) => s.running)
      var openTurnStart = useSession((s) => {
        var timings = s.turnTimings
        if (timings === undefined) return 0
        var latest = -1
        var start = 0
        var open = false
        for (const [turn, timing] of timings) {
          if (turn <= latest) continue
          latest = turn
          open = timing !== undefined && timing.endTime === undefined
          if (open && typeof timing.startTime === 'number') start = timing.startTime
        }
        return open ? start : 0
      })

      // 活动信号（真实）：工具调用数 / 是否在流式输出 / 是否在等用户
      var toolCount = useSession((s) => (Array.isArray(s.runningCalls) ? s.runningCalls.length : 0))
      var streaming = useSession((s) => s.partial !== null)
      var waitingOn = useSession((s) => (Array.isArray(s.pending) ? s.pending.length : 0))
      // 本会话已完成回合时长的中位数（自校准种子；无历史时为 0）
      var historySeed = useSession((s) => {
        var timings = s.turnTimings
        if (timings === undefined) return 0
        var durations = []
        for (const [, timing] of timings) {
          if (timing !== undefined && typeof timing.startTime === 'number' && typeof timing.endTime === 'number' && timing.endTime > timing.startTime) {
            durations.push(timing.endTime - timing.startTime)
          }
        }
        if (durations.length === 0) return 0
        durations.sort((a, b) => a - b)
        return durations[Math.floor(durations.length / 2)]
      })
      // goal 回合真实进度（会话投影，无目标时为 null）
      var goalPct = useProjection === null ? null : useProjection('goal', (p) => {
        if (p === undefined || p === null || p.goal === undefined || p.goal === null) return null
        var goal = p.goal
        if (typeof goal.maxGoalRounds !== 'number' || typeof p.roundsStarted !== 'number') return null
        if (goal.maxGoalRounds <= 0 || goal.phase !== 'active') return null
        return Math.min(99, (p.roundsStarted / goal.maxGoalRounds) * 100)
      })

      var [spriteUrl, setSpriteUrl] = React.useState(null)
      var [phase, setPhaseState] = React.useState('idle')
      var [progress, setProgress] = React.useState(0)
      var [frame, setFrame] = React.useState(0)
      var phaseRef = React.useRef('idle')
      var goalPctRef = React.useRef(null)
      var paceRef = React.useRef({ tools: 0, streaming: false, waiting: 0 })
      var seedRef = React.useRef(0)
      var diveStartRef = React.useRef(0)
      goalPctRef.current = goalPct
      paceRef.current = { tools: toolCount, streaming, waiting: waitingOn }
      seedRef.current = historySeed
      var setPhase = (next) => {
        phaseRef.current = next
        setPhaseState(next)
      }

      var currentExpected = () => {
        if (turnDurationHistory.length >= 2) {
          var sorted = turnDurationHistory.slice().sort((a, b) => a - b)
          return sorted[Math.floor(sorted.length / 2)]
        }
        var seed = seedRef.current
        return seed > 0 ? seed : MODEL.defaultExpectedMs
      }

      // 素材地址：与 Host 的 HTTP 路由同源
      React.useEffect(() => {
        if (typeof window === 'undefined' || !window.location || !window.location.origin) return
        setSpriteUrl(window.location.origin + SPRITE_PATH)
      }, [])

      // 状态机：idle → diving → done → idle
      React.useEffect(() => {
        if (running) {
          if (phaseRef.current === 'idle' || phaseRef.current === 'done') {
            diveStartRef.current = openTurnStart > 0 ? openTurnStart : Date.now()
            setProgress(0)
            setPhase('diving')
          }
        } else if (phaseRef.current === 'diving') {
          var duration = Date.now() - diveStartRef.current
          if (duration > 1500) {
            turnDurationHistory.push(duration)
            if (turnDurationHistory.length > MODEL.historySize) turnDurationHistory.shift()
          }
          setProgress(100)
          setPhase('done')
          // 完成音效由 Host 轮询 agents 系统级播放
          var stop = setTimeout(() => {
            setProgress(0)
            setPhase('idle')
          }, DONE_HOLD_MS)
          return () => { clearTimeout(stop) }
        }
      }, [running, openTurnStart])

      // 进度推进：通用自适应模型
      React.useEffect(() => {
        if (phase !== 'diving') return
        var alive = true
        var lastTick = Date.now()
        var workTime = 0
        var maxSeen = 0
        var startedAt = diveStartRef.current > 0 ? diveStartRef.current : Date.now()
        var expected = Math.max(MODEL.minExpectedMs, currentExpected())
        var tau = Math.max(3000, expected / MODEL.tauDivisor)

        var id = setInterval(() => {
          if (!alive) return
          var now = Date.now()
          var dt = Math.min(1000, Math.max(0, now - lastTick))
          lastTick = now
          var elapsed = Math.max(0, now - startedAt)

          var pace = paceRef.current
          var rate = MODEL.paceIdle
          if (pace.waiting > 0) rate = MODEL.paceWaiting
          else if (pace.tools > 0) rate = MODEL.paceTools
          else if (pace.streaming) rate = MODEL.paceStreaming

          workTime += dt * rate
          var timeP = 100 * (1 - Math.exp(-workTime / tau))
          var goalP = goalPctRef.current !== null ? goalPctRef.current : 0
          var reserve = Math.max(MODEL.reserveFloorPct, MODEL.reserveBasePct * Math.exp(-elapsed / (MODEL.reserveTimeScale * expected)))
          var cap = 100 - reserve
          var next = Math.min(cap, Math.max(timeP, goalP))
          maxSeen = Math.max(maxSeen, next)
          setProgress((prev) => {
            var rounded = Math.floor(maxSeen * 10) / 10
            return Math.abs(rounded - prev) < 0.1 ? prev : rounded
          })
        }, 200)
        return () => {
          alive = false
          clearInterval(id)
        }
      }, [phase])

      // 当前档位：动作 + 文案
      var anim = ROWS.waiting
      var text = ''
      if (phase === 'done') {
        anim = ROWS.jump
        text = DONE_TEXT
      } else {
        var stage = STAGES[STAGES.length - 1]
        for (var i = 0; i < STAGES.length; i++) {
          if (progress < STAGES[i].upTo) {
            stage = STAGES[i]
            break
          }
        }
        anim = ROWS[stage.anim] || ROWS.waiting
        text = stage.text
      }

      // 逐帧播放当前动作
      React.useEffect(() => {
        var disposed = false
        var stopTimer = null
        var count = anim.count || 6
        var step = (i) => {
          if (disposed) return
          setFrame(i)
          var delay = (anim.frames && anim.frames[i]) || 150
          stopTimer = setTimeout(() => step((i + 1) % count), delay)
        }
        step(0)
        return () => {
          disposed = true
          if (stopTimer) clearTimeout(stopTimer)
        }
      }, [anim])

      if (phase === 'idle') return null

      var pct = Math.round(progress)
      var col = frame % (anim.count || 6)
      var bgX = -(col * W)
      var bgY = -(anim.row * H)
      var petLeft = (3 + progress * 0.94) + '%'

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

    function apply(ctx) {
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
        { name: 'conversation.input.dock', id: 'dsh-ikun-pet', order: 50, label: 'ikun 桌宠 · dsh-ikun-pet' },
        (props) => React.createElement(DiveProgress, props),
      ))
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
