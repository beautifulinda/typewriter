// ---------- 畫紙（每個字怎麼畫在 draw.js） ----------
// page 是 null 就畫全部（螢幕上一長條紙）；列印時一頁一頁畫
function renderSheet(target, page, g, pageTop = 0) {
  const L = layoutRows(g);
  for (let i = 0; i < lines.length; i++) {
    if (page != null && L[i].page !== page) continue;
    const row = document.createElement('div');
    row.className = L[i].n === 2 ? 'line tall' : 'line';
    row.style.top = (lineTop(L[i], g) - pageTop) + 'px';
    lines[i].forEach(ch => row.appendChild(charEl(ch)));
    target.appendChild(row);
    const sc = lines[i].find(ch => ch.score != null);
    if (sc) target.appendChild(scoreEl(sc.score, parseFloat(row.style.top)));
  }
}
let lineEls = [], pagesShown = 0;
function renderAll() {
  const g = geo();
  paper.style.setProperty('--lh', g.lh + 'px');
  track.style.setProperty('--cw', g.cw + 'px');
  const pages = pagesShown = pageCount();
  paper.style.height = pages * PAGE_H + 'px';
  paper.innerHTML = '';
  for (let p = 1; p < pages; p++) {
    const b = document.createElement('div');
    b.className = 'pagebreak'; b.style.top = p * PAGE_H + 'px';
    b.innerHTML = `<span>A4 第 ${p + 1} 頁</span>`;
    paper.appendChild(b);
  }
  for (let p = 0; p < pages; p++) paper.appendChild(dateEl(p, p * PAGE_H));
  renderSheet(paper, null, g);
  lineEls = [...paper.querySelectorAll('.line')];
  place(false);
}
function place(returning) {
  const g = geo();
  const li = lines.length - 1, pos = layoutRows(g)[li];
  const caret = MARGIN + cellsOf(lines[li]) * g.cw;
  const top = lineTop(pos, g);
  const typeY = win.clientHeight - 26;                    // 打字點在滾筒正上方
  const x = win.clientWidth / 2 - caret - g.cw / 2;
  paper.classList.toggle('returning', !!returning);
  paper.style.transform = `translate(${x}px, ${typeY - top - pos.n * g.lh}px)`;
  track.classList.toggle('returning', !!returning);
  track.style.transform = `translateX(${x}px)`;
  guide.style.top = (typeY - 2) + 'px'; guide.style.height = '0';
  strike.style.top = (typeY - g.lh * 0.55) + 'px';
  const total = lines.reduce((n, l) => n + l.filter(c => c.c !== ' ').length, 0);
  $('pos').textContent = `第 ${pos.page + 1} 頁 · 第 ${pos.row + 1} 行 · 第 ${cellsOf(lines[li]) + 1} 格`;
  $('count').textContent = `${total} 字`;
  $('preedit').style.top = (typeY - g.lh - 44) + 'px';
  placeIme();
}
// 頁數變了（多一張紙或少一張）就整張重畫：分頁線、日期、紙的長度
function ensurePage() {
  if (pageCount() !== pagesShown) { renderAll(); return true; }
  return false;
}

// ---------- 打字 ----------
function save() { try { localStorage.setItem(STORE, JSON.stringify({ mode, bpmf, lines, pageDates })); } catch {} }
let saveTimer;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };

function newLine(withSound = true) {
  breakLine(lines);
  showNewLine(withSound);
}
// 畫面上多一行（資料已經換行了）
function showNewLine(withSound) {
  if (withSound) { sounds.ret(); sounds.bell(0.02); buzz(20); }
  ensurePage();
  if (lineEls.length < lines.length) {
    const g = geo();
    const row = document.createElement('div');
    row.className = 'line';
    row.style.top = lineTop(layoutRows(g).at(-1), g) + 'px';
    paper.appendChild(row); lineEls.push(row);
  }
  place(true); saveSoon();
}
// 字錘打上去的動畫
function hit() {
  sounds.key(); strike.classList.remove('on'); void strike.offsetWidth; strike.classList.add('on');
  typebar.style.setProperty('--a', (Math.random() * 140 - 70).toFixed(0) + 'deg');
  typebar.classList.remove('on'); void typebar.offsetWidth; typebar.classList.add('on');
}
const redraw = ch => spanOf.get(ch)?.replaceWith(charEl(ch));
// 打字、退格：先由 typeInto／backFrom（kinds.js）改資料，這裡照回傳的結果更新畫面、出聲音
function typeChar(c) {
  const g = geo();
  const r = typeInto(lines, c, g.cols);
  if (r.join) { redraw(r.join); hit(); buzz(6); saveSoon(); return; }      // 注音併進同一格，滑架不動
  if (r.close) { sounds.space(); saveSoon(); return; }
  const ch = r.add, line = lines.at(-1);
  if (r.wrap) showNewLine(true);
  // 這一行變高了（第一個注音格子）：整張重畫
  if (r.grow) renderAll(); else lineEls[lines.length - 1].appendChild(charEl(ch));
  resolveAround();
  if (c === ' ') sounds.space(); else hit();
  buzz(6);
  const left = g.cols - cellsOf(line);
  if (left === 6 || left === 5 && ch.w === 2) sounds.bell();             // 快到邊界的提醒鈴
  place(false); saveSoon();
}
function backspace() {
  const r = backFrom(lines);
  if (r.shrink) { redraw(r.shrink); sounds.back(); }
  else if (r.pop) {
    lineEls[lines.length - 1].lastChild?.remove(); resolveAround();
    if (r.shrunk) renderAll();
    sounds.back(); place(false);
  } else if (r.unline) {
    lineEls.pop()?.remove();
    sounds.back();
    if (!ensurePage()) place(true);
  }
  saveSoon();
}
// 一次來好幾個字（注音選字、貼上）時，一個一個打出來，每個字都有聲音
let queue = [], draining = false;
function enqueue(text) {
  if (practice) return;           // 練習時由 practiceInput 處理
  for (const c of text.replace(/\r/g, '')) queue.push(c);
  if (!draining) drain();
}
function drain() {
  draining = true;
  const c = queue.shift();
  if (c === undefined) { draining = false; return; }
  if (c === '\n') newLine(true); else if (c !== '\t') typeChar(c);
  setTimeout(drain, queue.length > 40 ? 15 : 55);
}
