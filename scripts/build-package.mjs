// 生成 cordis_define 一键安装载荷
// 用法：node scripts/build-package.mjs > ikun.package.json
// 产物可直接粘贴给 DSH 的 cordis_define 工具（code.host / code.client 已内嵌源码）
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const host = readFileSync(join(root, 'src', 'host.js'), 'utf-8')
const client = readFileSync(join(root, 'src', 'client.js'), 'utf-8')

const payload = {
  // cordis_define 参数（kind: "new" 表示创建新插件）
  plugin: { kind: 'new', idPrefix: 'ikun' },
  name: 'dsh-ikun-pet · ikun 桌宠',
  purpose: '在 DSH 每次回答问题的 Deep diving 期间，用坤宠动图填满深潜状态行下方的区块：进度条 0%→100%，每 20% 切换动作与文案，完成时播放「完成啦！你干嘛~哎哟」。',
  code: { host, client },
}

const out = process.argv[2] || join(root, 'ikun.package.json')
if (out === '-') {
  process.stdout.write(JSON.stringify(payload, null, 2))
} else {
  writeFileSync(out, JSON.stringify(payload, null, 2))
  console.log('已生成:', out)
  if (!existsSync(join(root, 'assets', 'spritesheet.webp'))) {
    console.warn('⚠️  注意：CONFIG.spritePath 指向的精灵图文件不存在，请先修改 src/host.js 顶部 CONFIG')
  }
}
