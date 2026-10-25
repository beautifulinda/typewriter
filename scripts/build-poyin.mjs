// 從 bpmfvs 下載破音詞庫，轉成 data/poyin.js。
// 用法：node scripts/build-poyin.mjs
// 只留下有兩個以上讀音的字；詞裡要有 * 才算（* 代表這個字）。

import { writeFile } from 'node:fs/promises'

const SOURCE = 'https://raw.githubusercontent.com/ButTaiwan/bpmfvs/master/ime/poyin_db.txt'
const OUTPUT = new URL('../data/poyin.js', import.meta.url)

const text = await (await fetch(SOURCE)).text()
const db = {}
for (const line of text.split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue
  // 格式：[字] 讀音<Tab>詞/詞/詞（有些字用 [字} 標示，一樣處理）
  const m = line.match(/^\[(.+?)[\]}] (\S+)\t?(.*)$/)
  if (!m) throw new Error(`看不懂這一行：${line}`)
  const [, c, reading, words] = m
  const pats = words.split('/').filter(p => p.includes('*') && p.trim())
  ;(db[c] ??= []).push([reading, pats])
}
for (const c of Object.keys(db)) if (db[c].length < 2 || [...c].length !== 1) delete db[c]

const header = `// 破音詞庫：來自 ButTaiwan/bpmfvs 的 ime/poyin_db.txt（依教育部《國語一字多音審訂表》），Apache License 2.0。
// 格式：{ 字: [[讀音, [詞, …]], …] }，詞裡的 * 代表這個字；讀音順序與注音字型的 IVS 順序相同（第 j 個讀音 = 字 + U+E01E0 + j）。
// 重新產生：node scripts/build-poyin.mjs（見 README）
`
await writeFile(OUTPUT, `${header}const POYIN = ${JSON.stringify(db)};\n`)
console.log(`已寫入 data/poyin.js：${Object.keys(db).length} 個破音字`)
