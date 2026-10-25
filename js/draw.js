// ---------- 畫字：每種字的 ink（kinds.js）算好要畫什麼、畫在哪，這裡照著畫到螢幕（DOM）或 canvas（圖片、PDF） ----------
// 尺寸只寫在 JS（這裡和 kinds.js、zhuyin.js），CSS 用這裡設定的變數；顏色只寫在 CSS，canvas 從 CSS 讀
const FACE = {
  type: '"Special Elite", "Noto Serif TC", monospace',
  cjk: '"Noto Serif TC", serif',
  bpmf: '"Bpmf Zihi Kai Std", "Noto Serif TC", serif',
};
const WEIGHT = { cjk: 600 };                  // Noto Serif TC 只載入 600
const fontOf = m => `${WEIGHT[m.face] || 400} ${m.size}px ${FACE[m.face]}`;
// 練習打錯的紅圈：寬、高是這一格的幾倍，轉幾度
const RING = { w: 1.08, h: .88, rot: -8 };
// 注音格子：外框實線、中間虛線十字（虛線長、間隔 px），不跟著字歪
const GRID = { alpha: .8, dash: 2, gap: 3 };
// 每一頁右上角的日期：靠右對齊右邊界，中心離紙的上緣 y
const DATE = { size: 15, alpha: .85, y: 52, lh: 20 };
// 分數：寫在右邊界外，中心比那一行的上緣低 dy
const SCORE = { size: 54, small: .42, rot: -9, x: PAGE_W - MARGIN + 6, dy: 5 };

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--ring-w', RING.w * 100 + '%');
rootStyle.setProperty('--ring-h', RING.h * 100 + '%');
rootStyle.setProperty('--ring-rot', RING.rot + 'deg');
rootStyle.setProperty('--grid-alpha', GRID.alpha);
rootStyle.setProperty('--grid-dash', GRID.dash + 'px');
rootStyle.setProperty('--grid-step', GRID.dash + GRID.gap + 'px');
const cssColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const inkTransform = ch => `translateY(${ch.y}px) rotate(${ch.r}deg)`;

// ---------- 螢幕（DOM） ----------
const setFont = (el, m) => { el.style.fontSize = m.size + 'px'; el.style.fontFamily = FACE[m.face]; el.style.fontWeight = WEIGHT[m.face] || 400; };
function charEl(ch) {
  const g = geo(), k = kindOf(ch), s = document.createElement('span');
  s.className = 'ch ' + k.name;
  s.style.width = cells(ch) * g.cw + 'px';
  spanOf.set(ch, s); chOf.set(s, ch);
  if (ch.bad) s.classList.add('bad');
  const ink = k.ink(ch, g);
  if (k.grid) {
    // 格子是 .ch.grid::before；墨色、歪斜只套在字上（.ink），格子保持端正
    s.classList.add('grid'); s.setAttribute('aria-label', ch.c);
    s.style.height = k.rows * g.lh + 'px';
    const box = document.createElement('span');
    box.className = 'ink'; box.style.opacity = ch.o; box.style.transform = inkTransform(ch);
    for (const m of ink) {
      const i = document.createElement('i');
      i.style.left = m.x + 'px'; i.style.top = m.y + 'px';
      if (m.dot) { i.className = 'dot'; i.style.width = i.style.height = m.r * 2 + 'px'; }
      else { i.textContent = m.s; setFont(i, m); if (m.align === 'left') i.className = 'left'; }
      box.appendChild(i);
    }
    s.appendChild(box);
    return s;
  }
  // 一般的字照文字排（破音字改讀音時直接換 textContent）
  s.textContent = ink[0].s; setFont(s, ink[0]);
  if (bpmf && POYIN[ch.c]) s.classList.add('poly');
  s.style.opacity = ch.o;
  s.style.transform = inkTransform(ch);
  return s;
}
function dateEl(p, pageTop) {
  const el = document.createElement('div');
  el.className = 'date'; el.textContent = pageDate(p);
  el.style.cssText = `top:${pageTop + DATE.y - DATE.lh / 2}px;right:${MARGIN}px;font-size:${DATE.size}px;line-height:${DATE.lh}px;opacity:${DATE.alpha}`;
  return el;
}
function scoreEl(score, rowTop) {
  const el = document.createElement('div');
  el.className = 'score';
  el.style.left = SCORE.x + 'px'; el.style.top = rowTop + SCORE.dy - SCORE.size / 2 + 'px';
  el.style.fontSize = SCORE.size + 'px'; el.style.transform = `rotate(${SCORE.rot}deg)`;
  el.innerHTML = `${score}<small style="font-size:${SCORE.small}em">分</small>`;
  el.setAttribute('aria-label', `${score} 分`);
  return el;
}

// ---------- canvas（圖片、PDF） ----------
// 畫一筆。字跟螢幕一樣對齊行框中心：螢幕的行框中心在基線上 (ascent − descent) / 2，
// canvas 的 middle 是 em 方框中心，兩者差 1～2px，所以改從基線算
function fillMark(x, m, ox = 0, oy = 0) {
  if (m.dot) { x.beginPath(); x.arc(ox + m.x, oy + m.y, m.r, 0, Math.PI * 2); x.fill(); return; }
  x.font = fontOf(m); x.textAlign = m.align || 'center';
  x.textBaseline = 'alphabetic';                 // 先設好基線再量：量到的高度是從目前的基線算
  const t = x.measureText(m.s);
  if (t.fontBoundingBoxAscent == null) { x.textBaseline = 'middle'; x.fillText(m.s, ox + m.x, oy + m.y); return; }   // 舊瀏覽器量不到
  x.fillText(m.s, ox + m.x, oy + m.y + (t.fontBoundingBoxAscent - t.fontBoundingBoxDescent) / 2);
}
// 一個字：(cx, top) 是這一格的左上角，h 是這一行的高度（字在行裡上下置中，跟螢幕一樣）
function drawChar(x, ch, g, cx, top, h) {
  const k = kindOf(ch), w = cells(ch) * g.cw, cy = top + h / 2;
  if (k.grid) {
    x.save(); x.strokeStyle = cssColor('--grid'); x.globalAlpha = GRID.alpha; x.lineWidth = 1;
    x.strokeRect(cx + .5, top + .5, w - 1, h - 1);
    x.setLineDash([GRID.dash, GRID.gap]); x.beginPath();
    x.moveTo(cx + w / 2, top); x.lineTo(cx + w / 2, top + h);
    x.moveTo(cx, cy); x.lineTo(cx + w, cy); x.stroke(); x.restore();
  }
  if (ch.c === ' ') return;
  x.save(); x.globalAlpha = ch.o; x.fillStyle = cssColor('--ink');
  x.translate(cx + w / 2, cy + ch.y); x.rotate(ch.r * Math.PI / 180);
  for (const m of k.ink(ch, g)) fillMark(x, m);
  x.restore();
  if (ch.bad) {
    x.save(); x.strokeStyle = cssColor('--pen'); x.lineWidth = 2; x.globalAlpha = .9;
    x.beginPath(); x.ellipse(cx + w / 2, cy, w * RING.w / 2, h * RING.h / 2, RING.rot * Math.PI / 180, 0, Math.PI * 2); x.stroke(); x.restore();
  }
}
function drawDate(x, p) {
  x.save(); x.fillStyle = cssColor('--ink'); x.globalAlpha = DATE.alpha; x.textAlign = 'right'; x.textBaseline = 'middle';
  x.font = `${DATE.size}px ${FACE.type}`; x.fillText(pageDate(p), PAGE_W - MARGIN, DATE.y); x.restore();
}
// 分數和老師批改的兩條底線
function drawScore(x, score, rowTop) {
  x.save(); x.fillStyle = x.strokeStyle = cssColor('--pen'); x.lineWidth = 3; x.textBaseline = 'middle';
  x.translate(SCORE.x, rowTop + SCORE.dy); x.rotate(SCORE.rot * Math.PI / 180);
  x.textAlign = 'left'; x.font = `700 ${SCORE.size}px "Caveat", cursive`; x.fillText(String(score), 0, 0);
  const tw = x.measureText(String(score)).width;
  x.font = `700 ${SCORE.size * SCORE.small}px "Caveat", "Noto Serif TC", cursive`; x.fillText('分', tw + 2, 7);
  x.beginPath(); x.moveTo(-4, 26); x.lineTo(tw + 34, 24); x.moveTo(-2, 32); x.lineTo(tw + 32, 30); x.stroke();
  x.restore();
}
