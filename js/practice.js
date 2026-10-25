// ---------- 練習模式：結合韻與小文章，跟著提示一個鍵一個鍵打注音 ----------
const TONE_TIP = { ' ': '一聲：按空白鍵', 'ˊ': '二聲：按 6', 'ˇ': '三聲：按 3', 'ˋ': '四聲：按 4', '˙': '輕聲：按 7' };
const CODE2CHAR = {};
keys.querySelectorAll('.key[data-char]').forEach(k => { CODE2CHAR[k.dataset.code] = k.dataset.char; });
const charOfSym = sym => Object.keys(ZHUYIN).find(c => ZHUYIN[c] === sym);
const keyOfSym = sym => sym === ' ' ? keys.querySelector('[data-act="space"]') : keys.querySelector(`.key[data-char="${CSS.escape(charOfSym(sym) || '')}"]`);
// 注音拆成要按的鍵：聲母韻母照順序，最後是聲調（一聲按空白）
const keysOf = zy => [...zy.replace(/[ˊˇˋ˙]/g, ''), (zy.match(/[ˊˇˋ]$/) || [])[0] || (zy[0] === '˙' ? '˙' : ' ')];
const FINAL_RE = /([ㄧㄨㄩ])([ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥ])/;
const markFinal = zy => zy.replace(FINAL_RE, '<mark>$1$2</mark>');
const lessonEl = $('lesson'), tilesEl = $('tiles'), nowEl = $('now');
$('lesson-pick').innerHTML = LESSONS.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

function startLesson(id) {
  const lesson = LESSONS.find(l => l.id === id) || LESSONS[0];
  // typed：這個字已經按的鍵；results：每個字最後交出去是對是錯；anchor：課文第一個字（分數寫在它那一行）
  practice = { lesson, i: 0, typed: [], results: [], anchor: null, done: false, keys: [] };
  $('lesson-pick').value = lesson.id;
  $('practice-btn').setAttribute('aria-pressed', true);
  picker.hidden = true; ime.blur(); document.activeElement?.blur?.();
  setLayout('zhuyin');
  if (!bpmf) $('bpmf').click();         // 練習一律用注音字、大字
  if (mode !== 'big') $('big').click();
  if (lines.at(-1).length) newLine(true);
  lessonEl.hidden = false;
  tilesEl.innerHTML = lesson.items.map(([c, zy]) =>
    `<span class="tile${zy ? '' : ' punct'}"><b>${c}</b><small>${zy ? markFinal(zy) : '&nbsp;'}</small></span>`).join('');
  skipPunct(); renderPractice();
}
function endPractice() {
  practice = null;
  lessonEl.hidden = true; preedit.hidden = true;
  $('practice-btn').setAttribute('aria-pressed', false);
  renderPractice(); focusTyping();
}
function skipPunct() {
  const items = practice.lesson.items;
  while (practice.i < items.length && !items[practice.i][1]) { typeChar(items[practice.i][0]); practice.i++; }
  if (practice.i < items.length) { practice.keys = keysOf(items[practice.i][1]); return; }
  // 打完了：一個字 100 ÷ 字數 分，打對才算；打錯但交出去前有訂正也算對
  practice.done = true;
  practice.score = Math.round(100 * practice.results.filter(Boolean).length / practice.results.length);
  if (practice.anchor) practice.anchor.score = practice.score;
  newLine(true); renderAll(); saveSoon();
  setTimeout(() => sounds.bell(), 350);
  if (practice.score === 100) setTimeout(() => sounds.bell(), 650);
}
// 照課文指定的讀音打上紙（破音字不靠猜）
function typeWithReading(c, zy) {
  typeChar(c);
  const ch = lines.at(-1).at(-1), j = (POYIN[c] || []).findIndex(([r]) => r === zy);
  if (ch && j >= 0) { ch.v = j; ch.m = true; const sp = spanOf.get(ch); if (sp) sp.textContent = glyph(ch); }
  return ch;
}
function practiceInput(sym) {
  if (!practice || practice.done) return;
  const { typed, keys: want } = practice, j = typed.length;
  typed.push(sym);
  if (sym === want[j]) sym === ' ' ? sounds.space() : sounds.back();
  else { sounds.oops(); buzz(30); practice.flash = true; }
  if (typed.length === want.length) {          // 按完最後一個鍵（聲調）就交出這個字
    const right = typed.every((t, n) => t === want[n]);
    const [c, zy] = practice.lesson.items[practice.i];
    const ch = typeWithReading(c, zy);
    if (!right && ch) { ch.bad = true; spanOf.get(ch)?.classList.add('bad'); }
    practice.anchor ??= ch;
    practice.results.push(right);
    if (practice.lesson.final) typeChar(' ');
    practice.i++; practice.typed = [];
    skipPunct();
  }
  renderPractice();
}
function practiceUndo() {   // 退格：訂正這個字還沒交出去的鍵
  if (practice && !practice.done && practice.typed.length) { practice.typed.pop(); sounds.back(); renderPractice(); }
}
// 實體鍵盤：看按鍵位置（e.code）對應注音，跟電腦的注音輸入法同一個位置
function practiceKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.code === 'Tab') return false;
  if (e.target.closest?.('select')) return false;
  if (e.target.closest?.('button') && (e.code === 'Space' || e.code === 'Enter')) return false;
  e.preventDefault();
  if (e.repeat) return true;
  if (e.code === 'Escape') endPractice();
  else if (e.code === 'Space') practiceInput(' ');
  else if (e.code === 'Backspace') practiceUndo();
  else if (ZHUYIN[CODE2CHAR[e.code]]) practiceInput(ZHUYIN[CODE2CHAR[e.code]]);
  return true;
}
function renderPractice() {
  keys.querySelectorAll('.key.next').forEach(k => k.classList.remove('next'));
  if (!practice) return;
  const { lesson, i } = practice, items = lesson.items;
  [...tilesEl.children].forEach((t, j) => { t.classList.toggle('done', j < i); t.classList.toggle('cur', j === i && !practice.done); });
  // 交出去的字：錯的在字卡上也畫紅圈
  let r = 0;
  items.forEach(([, zy], j) => { if (!zy) return; tilesEl.children[j].classList.toggle('wrong', j < i && practice.results[r] === false); r++; });
  const cur = tilesEl.children[Math.min(i, items.length - 1)];
  if (cur) tilesEl.scrollTo({ left: cur.offsetLeft - tilesEl.clientWidth / 2 + cur.offsetWidth / 2, behavior: 'smooth' });
  const total = items.filter(x => x[1]).length, doneCount = practice.results.length;
  const wrongs = practice.results.filter(r => !r).length;
  $('lesson-stat').textContent = `第 ${Math.min(doneCount + 1, total)}／${total} 字 · 一個字 ${+(100 / total).toFixed(1)} 分` + (wrongs ? ` · 錯 ${wrongs} 個` : '');
  if (practice.done) {
    preedit.hidden = true;
    const msg = practice.score === 100 ? '全對！好厲害！' : `錯了 ${wrongs} 個字，紙上畫圈的就是。`;
    nowEl.innerHTML = `<span class="score-big">${practice.score}</span><div class="done-msg">${msg}</div><div class="done-actions"></div>`;
    const act = nowEl.querySelector('.done-actions');
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tool'; b.textContent = label; b.onclick = fn; act.appendChild(b); };
    mk('再練一次', () => startLesson(lesson.id));
    const next = LESSONS[LESSONS.indexOf(lesson) + 1];
    if (next) mk('下一課', () => startLesson(next.id));
    mk('結束練習', endPractice);
    return;
  }
  const [c, zy] = items[i], want = practice.keys, typed = practice.typed, fm = zy.match(FINAL_RE);
  const wrongAt = typed.findIndex((t, n) => t !== want[n]);
  const exp = want[typed.length];
  const name = sy => sy === ' ' ? '空白' : sy;
  const tip = wrongAt >= 0 ? `「${name(want[wrongAt])}」打成「${name(typed[wrongAt])}」了，按「退格」訂正喔！`
    : typed.length === want.length - 1 ? TONE_TIP[exp]
    : lesson.final && fm ? `結合韻：${fm[1]}＋${fm[2]}＝${fm[1]}${fm[2]}`
    : '照著注音，一個一個按。';
  nowEl.innerHTML = `<div class="now-char"><b>${c}</b><span>${markFinal(zy)}</span></div>
    <div class="chips">${want.map((sy, n) => {
      const st = n < typed.length ? (typed[n] === sy ? ' ok' : ' bad') : n === typed.length && wrongAt < 0 ? ' cur' : '';
      return `<span class="chip${st}">${name(sy)}<em>${sy === ' ' ? 'space' : (charOfSym(sy) === '?' ? '/' : charOfSym(sy) || '')}</em></span>`;
    }).join('')}</div>
    <div class="tip">${tip}</div>`;
  practice.flash = false;
  // 有打錯就讓退格鍵發亮，提醒先訂正
  (wrongAt >= 0 ? keys.querySelector('[data-act="back"]') : keyOfSym(exp))?.classList.add('next');
  const pre = typed.filter(sy => sy !== ' ').join('');
  preedit.textContent = pre; preedit.hidden = !pre;
}
$('practice-btn').onclick = () => practice ? endPractice() : startLesson($('lesson-pick').value);
$('lesson-close').onclick = endPractice;
$('lesson-pick').onchange = e => { startLesson(e.target.value); e.target.blur(); };
