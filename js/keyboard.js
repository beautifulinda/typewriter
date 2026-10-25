// ---------- 實體鍵盤與注音輸入 ----------
let composing = false;
const preedit = $('preedit');
ime.addEventListener('compositionstart', () => { composing = true; });
ime.addEventListener('compositionupdate', e => {
  const d = e.data || '';
  if (/[㄀-ㄯ]/.test(d)) setLayout('zhuyin', true);   // 拼出來的是ㄅㄆㄇ：電腦現在是注音輸入法
  preedit.textContent = d; preedit.hidden = !d;
  if (d) sounds.back();
});
ime.addEventListener('compositionend', e => { composing = false; preedit.hidden = true; enqueue(e.data || ''); ime.value = ''; });
ime.addEventListener('input', e => {
  if (composing || e.isComposing) return;
  if (e.inputType === 'insertText' && /[a-z]/i.test(ime.value)) setLayout('en', true);  // 沒經過選字就打出英文：電腦是英文輸入法
  if (e.inputType === 'insertText' || e.inputType === 'insertFromPaste' || e.inputType === 'insertReplacementText') enqueue(ime.value);
  ime.value = '';
});
ime.addEventListener('keydown', e => {
  if (e.isComposing || composing || e.keyCode === 229) return;
  if (e.key === 'Enter') { e.preventDefault(); enqueue('\n'); }
  else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
  else if (e.key === 'Tab') { e.preventDefault(); }
});
document.addEventListener('keydown', e => {
  if (practice && practiceKey(e)) { keyEl(e)?.classList.add('down'); return; }
  if (e.target !== ime && !e.target.closest?.('button')) {
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') ime.focus();
  }
  if (e.key === 'Escape') $('picker').hidden = true;
  keyEl(e)?.classList.add('down');
});
document.addEventListener('keyup', e => keyEl(e)?.classList.remove('down'));
const keyEl = e => document.querySelector(`.key[data-code="${e.code}"]`);

const coarse = matchMedia('(pointer: coarse)').matches;
// 練習時不讓輸入法接手（才能直接用按鍵位置對應注音）
const focusTyping = () => { if (practice) ime.blur(); else if (!coarse) ime.focus({ preventScroll: true }); };
win.addEventListener('click', () => { audio(); focusTyping(); });

// ---------- 畫面上的圓鍵（平板、手機） ----------
const ROWS = [
  '1234567890-', 'QWERTYUIOP', 'ASDFGHJKL;', 'ZXCVBNM,.?',
];
const codeFor = c => /[A-Z]/.test(c) ? 'Key' + c : /\d/.test(c) ? 'Digit' + c : ({ '-': 'Minus', ',': 'Comma', '.': 'Period', '?': 'Slash', ';': 'Semicolon' })[c];
const keys = $('keys');
let shift = false;
ROWS.forEach(r => {
  const row = document.createElement('div'); row.className = 'row';
  for (const c of r) {
    const b = document.createElement('button');
    b.className = 'key' + (/\d/.test(c) ? ' split' : /[A-Z]/.test(c) ? '' : ' mustard');
    b.innerHTML = `<span class="side"></span><span class="rim"><span class="face"><b class="main"></b><small class="sub"></small></span></span>`;
    b.dataset.char = c; b.dataset.code = codeFor(c);
    row.appendChild(b);
  }
  keys.appendChild(row);
});
const last = document.createElement('div'); last.className = 'row';
last.innerHTML = `
  <button class="key wide ivory" data-act="shift" data-code="ShiftLeft" aria-pressed="false"><span class="side"></span><span class="rim"><span class="face">大寫</span></span></button>
  <button class="key wide space chrome" data-act="space" data-code="Space" aria-label="空白"><span class="side"></span><span class="rim"><span class="face"></span></span></button>
  <button class="key wide ivory" data-act="back" data-code="Backspace"><span class="side"></span><span class="rim"><span class="face">退格</span></span></button>
  <button class="key wide red" data-act="ret" data-code="Enter"><span class="side"></span><span class="rim"><span class="face">換行</span></span></button>`;
keys.appendChild(last);
function renderLegends() {
  keys.querySelectorAll('.key[data-char]').forEach(k => {
    const c = k.dataset.char, zy = ZHUYIN[c] || '';
    const main = k.querySelector('.main'), sub = k.querySelector('.sub');
    const zyMain = layout === 'zhuyin' && zy;
    main.textContent = zyMain ? zy : c; main.classList.toggle('zy', !!zyMain);
    sub.textContent = zyMain ? c : zy; sub.classList.toggle('zy', !zyMain);
    k.setAttribute('aria-label', zyMain ? `${zy}（${c}）` : c);
  });
  $('layout').textContent = layout === 'zhuyin' ? '鍵帽 ㄅㄆㄇ' : '鍵帽 ABC';
  $('layout').setAttribute('aria-pressed', layout === 'zhuyin');
}
// auto：打字時偵測到輸入法改變而自動切換，提示一次
function setLayout(next, auto = false) {
  if (next === layout) return;
  layout = next; renderLegends();
  try { localStorage.setItem('typewriter:layout', layout); } catch {}
  if (auto) toast(layout === 'zhuyin' ? '偵測到注音輸入法，鍵帽換成 ㄅㄆㄇㄈ。' : '偵測到英文輸入，鍵帽換回 ABC。');
}
$('layout').onclick = () => { setLayout(layout === 'zhuyin' ? 'en' : 'zhuyin'); focusTyping(); };
try { if (localStorage.getItem('typewriter:layout') === 'zhuyin') layout = 'zhuyin'; } catch {}
renderLegends();

// 每顆鍵舊得不一樣：用位置當種子，重新整理頁面也不會變
const seeded = n => { const x = Math.sin(n * 99.13 + 7.7) * 43758.5453; return x - Math.floor(x); };
keys.querySelectorAll('.key').forEach((k, i) => {
  k.style.setProperty('--tarnish', (0.25 + seeded(i) * 0.75).toFixed(2));
  k.style.setProperty('--sx', (12 + seeded(i + 31) * 60).toFixed(0) + '%');
  k.style.setProperty('--sy', (40 + seeded(i + 57) * 50).toFixed(0) + '%');
  k.style.setProperty('--yellow', (0.08 + seeded(i + 83) * 0.42).toFixed(2));
});
keys.addEventListener('pointerdown', e => {
  const b = e.target.closest('.key'); if (!b) return;
  e.preventDefault();                        // 不讓按鈕搶走焦點、也不叫出系統鍵盤
  audio();
  if (practice) {
    if (b.dataset.act === 'space') practiceInput(' ');
    else if (b.dataset.act === 'back') practiceUndo();
    else if (ZHUYIN[b.dataset.char]) practiceInput(ZHUYIN[b.dataset.char]);
    return;
  }
  const act = b.dataset.act;
  if (act === 'space') enqueue(' ');
  else if (act === 'back') backspace();
  else if (act === 'ret') enqueue('\n');
  else if (act === 'shift') { shift = !shift; b.setAttribute('aria-pressed', shift); b.classList.toggle('down', shift); }
  else {
    const c = b.dataset.char;
    // 注音鍵帽直接打出注音符號（小朋友先學注音）；要選成國字請用系統輸入法
    if (layout === 'zhuyin' && ZHUYIN[c]) enqueue(ZHUYIN[c]);
    else enqueue(shift ? c : c.toLowerCase());
  }
});
keys.addEventListener('click', e => {        // 用 Tab 移到鍵上按 Enter／空白時
  if (e.detail !== 0) return;
  const b = e.target.closest('.key'); if (!b) return;
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
});
