// ---------- 畫紙 ----------
function charEl(ch) {
  const s = document.createElement('span');
  s.className = ch.w === 2 ? 'ch wide' : 'ch';
  if (ch.zy) {
    const { syms, tone } = zyParts(ch);
    s.classList.add('zy'); s.setAttribute('aria-label', ch.c);
    // 墨色、歪斜只套在字上（.zy-ink），背後的格子保持端正
    s.innerHTML = `<span class="zy-ink" style="opacity:${ch.o};transform:translateY(${ch.y}px) rotate(${ch.r}deg)">`
      + `<span class="zy-col">${tone === '˙' ? '<i>˙</i>' : ''}${syms.map(c => `<i>${c}</i>`).join('')}</span>`
      + (tone && tone !== '˙' ? `<i class="zy-tone" style="--k:${(syms.length - 2) / 2}">${tone}</i>` : '') + '</span>';
    spanOf.set(ch, s); chOf.set(s, ch);
    return s;
  } else s.textContent = glyph(ch);
  if (bpmf && POYIN[ch.c]) s.classList.add('poly');
  if (ch.bad) s.classList.add('bad');
  spanOf.set(ch, s); chOf.set(s, ch);
  s.style.opacity = ch.o;
  s.style.transform = `translateY(${ch.y}px) rotate(${ch.r}deg)`;
  return s;
}
function renderSheet(target, from, to, g, pageTop = 0) {
  for (let i = from; i < to; i++) {
    const row = document.createElement('div');
    row.className = 'line';
    row.style.top = (MARGIN + (i % g.rows) * g.lh + Math.floor(i / g.rows) * PAGE_H - pageTop) + 'px';
    lines[i].forEach(ch => row.appendChild(charEl(ch)));
    target.appendChild(row);
    const sc = lines[i].find(ch => ch.score != null);
    if (sc) target.appendChild(scoreEl(sc.score, parseFloat(row.style.top)));
  }
}
function scoreEl(score, top) {
  const el = document.createElement('div');
  el.className = 'score'; el.style.top = (top - 22) + 'px';
  el.innerHTML = `${score}<small>分</small>`;
  el.setAttribute('aria-label', `${score} 分`);
  return el;
}
let lineEls = [];
function renderAll() {
  const g = geo();
  paper.style.setProperty('--fs', g.fs + 'px');
  paper.style.setProperty('--lh', g.lh + 'px');
  paper.style.setProperty('--cw', g.cw + 'px');
  track.style.setProperty('--cw', g.cw + 'px');
  const pages = Math.max(1, Math.ceil(lines.length / g.rows));
  paper.style.height = pages * PAGE_H + 'px';
  paper.innerHTML = '';
  for (let p = 1; p < pages; p++) {
    const b = document.createElement('div');
    b.className = 'pagebreak'; b.style.top = p * PAGE_H + 'px';
    b.innerHTML = `<span>A4 第 ${p + 1} 頁</span>`;
    paper.appendChild(b);
  }
  for (let p = 0; p < pages; p++) paper.appendChild(dateEl(p, p * PAGE_H + 42));
  renderSheet(paper, 0, lines.length, g);
  lineEls = [...paper.querySelectorAll('.line')];
  place(false);
}
function place(returning) {
  const g = geo();
  const li = lines.length - 1;
  const caret = MARGIN + cellsOf(lines[li]) * g.cw;
  const lineTop = MARGIN + (li % g.rows) * g.lh + Math.floor(li / g.rows) * PAGE_H;
  const typeY = win.clientHeight - 26;                    // 打字點在滾筒正上方
  const x = win.clientWidth / 2 - caret - g.cw / 2;
  paper.classList.toggle('returning', !!returning);
  paper.style.transform = `translate(${x}px, ${typeY - lineTop - g.lh}px)`;
  track.classList.toggle('returning', !!returning);
  track.style.transform = `translateX(${x}px)`;
  guide.style.top = (typeY - 2) + 'px'; guide.style.height = '0';
  strike.style.top = (typeY - g.lh * 0.55) + 'px';
  const total = lines.reduce((n, l) => n + l.filter(c => c.c !== ' ').length, 0);
  $('pos').textContent = `第 ${Math.floor(li / g.rows) + 1} 頁 · 第 ${li % g.rows + 1} 行 · 第 ${cellsOf(lines[li]) + 1} 格`;
  $('count').textContent = `${total} 字`;
  $('preedit').style.top = (typeY - g.lh - 44) + 'px';
  placeIme();
}
function ensurePage() {
  const g = geo();
  if (lines.length % g.rows === 1 && lines.length > 1) renderAll();
}

// ---------- 打字 ----------
function save() { try { localStorage.setItem(STORE, JSON.stringify({ mode, bpmf, lines, pageDates })); } catch {} }
let saveTimer;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };

function newLine(withSound = true) {
  lines.push([]);
  if (withSound) { sounds.ret(); sounds.bell(0.02); buzz(20); }
  ensurePage();
  if (lineEls.length < lines.length) {
    const g = geo();
    const row = document.createElement('div');
    row.className = 'line';
    const i = lines.length - 1;
    row.style.top = (MARGIN + (i % g.rows) * g.lh + Math.floor(i / g.rows) * PAGE_H) + 'px';
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
function typeChar(c) {
  const g = geo();
  let line = lines[lines.length - 1];
  const prev = line[line.length - 1];
  // 注音符號接在同一個音節裡（同一格疊成直式），滑架不動
  if (zyJoins(prev, c)) {
    prev.c += c; if (ZY_PART(c) === 3) prev.done = true;
    redraw(prev); hit(); buzz(6); saveSoon(); return;
  }
  // 音節還沒打聲調時按空白＝一聲，只結束這個音節，不空一格（跟注音輸入法一樣）
  if (c === ' ' && prev?.zy && !prev.done) { prev.done = true; sounds.space(); saveSoon(); return; }
  const ch = makeChar(c);
  if (isZy(c)) { ch.zy = true; ch.w = 2; if (ZY_PART(c) === 3) ch.done = true; }
  // 小朋友友善：打到右邊界自動換行（真正的打字機會卡住）
  if (cellsOf(line) + cells(ch) > g.cols) { newLine(true); line = lines[lines.length - 1]; }
  line.push(ch);
  lineEls[lines.length - 1].appendChild(charEl(ch));
  resolveAround();
  if (c === ' ') sounds.space(); else hit();
  buzz(6);
  const left = g.cols - cellsOf(line);
  if (left === 6 || left === 5 && ch.w === 2) sounds.bell();             // 快到邊界的提醒鈴
  place(false); saveSoon();
}
function backspace() {
  let line = lines[lines.length - 1];
  const last = line[line.length - 1];
  // 注音音節一次退一個符號
  if (last?.zy && [...last.c].length > 1) {
    last.c = [...last.c].slice(0, -1).join(''); last.done = false;
    redraw(last); sounds.back(); saveSoon(); return;
  }
  if (line.length) {
    line.pop(); lineEls[lines.length - 1].lastChild?.remove(); resolveAround();
    sounds.back(); place(false);
  } else if (lines.length > 1) {
    lines.pop(); lineEls.pop()?.remove();
    sounds.back();
    const g = geo(); if (lines.length % g.rows === 0) renderAll(); else place(true);
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
