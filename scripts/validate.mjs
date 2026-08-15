// You Are So Beautiful · 深潜进度桌宠 · 仓库完整性校验
// 用法：node scripts/validate.mjs
// 检查：素材存在且格式正确、插件源码结构正确、精灵图尺寸符合 8×9 契约
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0
const ok = (cond, msg) => {
  console.log((cond ? '  ✔ ' : '  ✘ ') + msg)
  if (!cond) failed++
}

// 1. 素材文件
const spritePath = join(root, 'assets', 'spritesheet.webp')
const voicePath = join(root, 'assets', 'voice.mp3')
ok(existsSync(spritePath), 'assets/spritesheet.webp 存在')
ok(existsSync(voicePath), 'assets/voice.mp3 存在（完成提示音，由宿主进程系统级播放）')

if (existsSync(spritePath)) {
  const buf = readFileSync(spritePath)
  // WebP RIFF 头 + VP8X 特征
  const isWebp = buf.length > 32 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP'
  ok(isWebp, 'spritesheet.webp 是合法 WebP（RIFF/WEBP 头）')
  if (isWebp) {
    const vp8x = buf.indexOf(Buffer.from('VP8X'))
    if (vp8x > 0 && buf.length > vp8x + 10) {
      const w = buf.readUIntLE(vp8x + 4, 3) + 1
      const h = buf.readUIntLE(vp8x + 7, 3) + 1
      ok(w === 1536 && h === 1872, `spritesheet.webp 尺寸为 1536×1872（实测 ${w}×${h}，契约要求 8 列 × 9 行、每格 192×208）`)
    }
  }
}
if (existsSync(voicePath)) {
  const buf = readFileSync(voicePath)
  const isMp3 = buf.length > 3 && (buf.slice(0, 3).toString('ascii') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))
  ok(isMp3, 'voice.mp3 是合法 MP3（ID3/MPEG 头）')
}

// 2. 插件源码：动态插件格式，函数体以 return { 开头，且包含 apply(ctx)
for (const [name, mustContain] of [
  ['src/host.js', ['apply(ctx)', 'beauty-dive-state', 'beauty-dive-voice', 'beauty-dive-goal', 'beauty_dive_debug', 'webServer.register']],
  ['src/client.js', ['apply(ctx)', 'conversation.input.dock', 'beauty-dive-voice', 'beauty-dive-goal', 'MODEL', 'STAGES', 'DiveProgress', 'DONE_TEXT']],
]) {
  const p = join(root, name)
  ok(existsSync(p), `${name} 存在`)
  if (existsSync(p)) {
    const src = readFileSync(p, 'utf-8')
    ok(/\n\s*return\s*\{/.test(src), `${name} 是动态插件格式（函数体顶层 return { … }）`)
    for (const token of mustContain) {
      ok(src.includes(token), `${name} 包含关键片段 ${token}`)
    }
  }
}

// 3. 安装载荷与文档
for (const p of ['beauty.package.json', 'README.md', 'demo/index.html', 'docs/PROGRESS-STAGES.md']) {
  ok(existsSync(join(root, p)), `${p} 存在`)
}

console.log(failed === 0 ? '\n✅ 校验通过' : `\n❌ ${failed} 项校验失败`)
process.exit(failed === 0 ? 0 : 1)
