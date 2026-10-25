// 共用的設定、狀態與紙張格子的計算。所有 js 檔照 index.html 的順序載入，共用最上層的變數。

// A4 在 96dpi 下是 794 × 1123 px，四邊留 25mm（約 94px）。紙上的位置用同一組數字，列印時不用換算
const PAGE_W = 794, PAGE_H = 1123, MARGIN = 94;
const MODES = {
  normal: { fs: 16, lh: 24 },   // 12pt，一行 63 格、一頁 38 行
  big:    { fs: 28, lh: 42 },   // 給小朋友，一行 36 格、一頁 22 行
};
const STORE = 'typewriter:draft';

const $ = id => document.getElementById(id);
const win = $('window'), paper = $('paper'), guide = $('guide'), strike = $('strike'), ime = $('ime');
const track = $('track'), typebar = $('typebar'), machine = document.querySelector('.machine');

let mode = 'big', soundOn = true, layout = 'zhuyin', bpmf = false;   // 第一次打開：大字、ㄅㄆㄇ
let practice = null;          // 練習模式進行中的狀態
let pageDates = [];           // 每一頁開始打的日期（YYYY-MM-DD）
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function pageDate(p) {
  if (!pageDates[p]) { pageDates[p] = todayISO(); saveSoon(); }
  const [y, m, d] = pageDates[p].split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日 星期${'日一二三四五六'[new Date(y, m - 1, d).getDay()]}`;
}
function dateEl(p, top) {
  const el = document.createElement('div');
  el.className = 'date'; el.style.top = top + 'px'; el.textContent = pageDate(p);
  return el;
}
// 隱藏輸入框跟著打字點走，系統的選字視窗才會出現在紙上
function placeIme() {
  const r = guide.getBoundingClientRect();
  ime.style.left = Math.max(0, Math.min(innerWidth - 2, r.left)) + 'px';
  ime.style.top = Math.max(0, Math.min(innerHeight - 2, r.top - 30)) + 'px';
}
addEventListener('scroll', () => placeIme(), { passive: true });
// 每一行是字的陣列；每個字記住自己的墨色與歪斜，重畫時不會變
let lines = [[]];

const geo = () => {
  const m = MODES[mode];
  const cw = m.fs * 0.6;
  return { ...m, cw, cols: Math.floor((PAGE_W - MARGIN * 2) / cw), rows: Math.floor((PAGE_H - MARGIN * 2) / m.lh) };
};
const isWide = c => /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3fffd}]/u.test(c);
const cells = ch => ch.zy ? 3 : ch.w === 2 ? (bpmf ? 3 : 2) : 1;
// 有注音格子的行佔兩行高（格子要放得下三個符號直排，行距 0.9）
const lineSpan = line => line.some(ch => ch.zy) ? 2 : 1;
// 每一行在第幾頁、從第幾列開始、佔幾列；一行不會跨頁
function layoutRows(g = geo()) {
  const out = []; let page = 0, row = 0;
  for (const line of lines) {
    const n = lineSpan(line);
    if (row + n > g.rows) { page++; row = 0; }
    out.push({ page, row, n }); row += n;
  }
  return out;
}
const lineTop = (pos, g) => MARGIN + pos.row * g.lh + pos.page * PAGE_H;
const pageCount = () => layoutRows().at(-1).page + 1;
const cellsOf = line => line.reduce((n, ch) => n + cells(ch), 0);
const makeChar = c => ({
  c, w: isWide(c) ? 2 : 1,
  r: +(Math.random() * 3 - 1.5).toFixed(2),      // 字稍微歪一點
  o: +(0.72 + Math.random() * 0.28).toFixed(2),   // 色帶墨色深淺不一
  y: +(Math.random() * 1.6 - 0.8).toFixed(2),     // 上下差一點點
});
