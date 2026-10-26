// ---------- 實體鍵盤與注音輸入 ----------
let composing = false;
const preedit = $('preedit');
// 練習與不經過輸入法的模式（LAYOUTS 的 ime: false）看按鍵位置打注音，輸入框不能拿到焦點：
// 不然電腦的輸入法會同時在裡面拼字，送出時一次打上一大串
const imeOff = () => practice || !LAYOUTS[layout].ime;
ime.addEventListener('focus', () => { if (imeOff()) ime.blur(); });
ime.addEventListener('compositionstart', () => { composing = true; });
ime.addEventListener('compositionupdate', e => {
  const d = e.data || '';
  if (/[㄀-ㄯ]/.test(d) && layout === 'en') setLayout('ime', 'auto');   // 拼出來的是ㄅㄆㄇ：電腦現在是注音輸入法
  preedit.textContent = d; preedit.hidden = !d;
  if (d) sounds.back();
});
ime.addEventListener('compositionend', e => { composing = false; preedit.hidden = true; if (!imeOff()) enqueue(e.data || ''); ime.value = ''; });
ime.addEventListener('input', e => {
  if (composing || e.isComposing) return;
  if (imeOff()) { ime.value = ''; return; }
  if (e.inputType === 'insertText' && /[a-z]/i.test(ime.value) && layout === 'ime') setLayout('en', 'auto');  // 沒經過選字就打出英文：電腦是英文輸入法
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
  if (!practice && layout === 'zhuyin' && zhuyinKey(e)) { keyEl(e)?.classList.add('down'); return; }
  if (e.target !== ime && !e.target.closest?.('button')) {
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') ime.focus();
  }
  if (e.key === 'Escape') $('picker').hidden = true;
  keyEl(e)?.classList.add('down');
});
document.addEventListener('keyup', e => {
  if (e.key === 'Meta') releaseKeys();                  // Mac 按住 Command 時，其他鍵放開不會送 keyup
  else release(keyEl(e));
});
const keyEl = e => document.querySelector(`.key[data-code="${e.code}"]`);
// 鍵帽彈回來；畫面上的「大寫」按著時不彈
const release = k => { if (k && !(k.dataset.act === 'shift' && shift)) k.classList.remove('down'); };
// 收不到 keyup 的時候（切到別的視窗、跳出聽寫、切換全螢幕），鍵帽全部彈回來，不然會一直壓著
const releaseKeys = () => keys.querySelectorAll('.key.down').forEach(release);
addEventListener('blur', releaseKeys);
document.addEventListener('visibilitychange', releaseKeys);

const coarse = matchMedia('(pointer: coarse)').matches;
// 練習或 ㄅㄆㄇ 模式不讓輸入法接手（才能直接用按鍵位置對應注音）；國字模式在平板上也要叫出系統鍵盤
// 剛按過的按鈕也要放掉焦點，不然 Enter／空白會變成再按一次按鈕，打不上紙
const focusTyping = () => {
  if (imeOff()) { ime.blur(); document.activeElement?.closest?.('button')?.blur(); }
  else if (!coarse || layout === 'ime') ime.focus({ preventScroll: true });
};
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
  document.querySelectorAll('[data-layout]').forEach(b => b.setAttribute('aria-pressed', b.dataset.layout === layout));
}
// 輸入有三種（ime：經不經過電腦的輸入法；tip：切過來時的提示）：
//   en     ABC：照電腦的輸入法打
//   zhuyin ㄅㄆㄇ：直接打注音符號，不選字。實體鍵盤看按鍵位置對應注音，不經過電腦的輸入法
//   ime    國字：用電腦的注音輸入法選字
// why：'auto' 是打字時偵測到輸入法改變而自動切換；'click' 是自己按的。兩種都提示一次
const LAYOUTS = {
  en: { ime: true, tip: '打英文。電腦的輸入法請切到英文。' },
  zhuyin: { ime: false, tip: '直接打注音符號，不會選成國字。標點按住 Shift：Shift＋逗點＝，　Shift＋句點＝。' },
  ime: { ime: true, tip: '用電腦的注音輸入法打字，選好的國字會打上紙。電腦的輸入法請切到注音。' },
};
function setLayout(next, why) {
  if (next === layout) return;
  layout = next; renderLegends();
  try { localStorage.setItem('typewriter:layout', layout); } catch {}
  if (why === 'auto') toast(layout === 'ime' ? '偵測到注音輸入法，換成「國字」。想直接打注音符號請按「ㄅㄆㄇ」。' : '偵測到英文輸入，換成「ABC」。');
  else if (why === 'click') toast(LAYOUTS[layout].tip);
}
document.querySelectorAll('[data-layout]').forEach(b => {
  b.onclick = () => { setLayout(b.dataset.layout, 'click'); audio(); focusTyping(); };
});
try { const saved = localStorage.getItem('typewriter:layout'); if (saved in LAYOUTS) layout = saved; } catch {}
renderLegends();
// 實體鍵盤的按鍵位置 → 鍵帽上的字（e.code → 'Q'）
const CODE2CHAR = {};
keys.querySelectorAll('.key[data-char]').forEach(k => { CODE2CHAR[k.dataset.code] = k.dataset.char; });
// ㄅㄆㄇ 模式：實體鍵盤直接打出注音符號
function zhuyinKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.code === 'Tab') return false;
  if (e.target.closest?.('select, input')) return false;
  if (e.target.closest?.('button') && (e.code === 'Space' || e.code === 'Enter')) return false;
  const c = CODE2CHAR[e.code], sym = ZHUYIN[c];
  if (e.shiftKey && ZY_PUNCT[c]) enqueue(ZY_PUNCT[c]);
  else if (e.code === 'Enter') enqueue('\n');
  else if (e.code === 'Backspace') backspace();
  else if (e.code === 'Space') enqueue(' ');
  else if (e.code === 'Escape') { $('picker').hidden = true; return false; }
  else if (sym) enqueue(sym);
  else return false;
  e.preventDefault();
  return true;
}

// 每顆鍵舊得不一樣：用位置當種子，重新整理頁面也不會變
const seeded = n => { const x = Math.sin(n * 99.13 + 7.7) * 43758.5453; return x - Math.floor(x); };
keys.querySelectorAll('.key').forEach((k, i) => {
  k.style.setProperty('--tarnish', (0.25 + seeded(i) * 0.75).toFixed(2));
  k.style.setProperty('--sx', (12 + seeded(i + 31) * 60).toFixed(0) + '%');
  k.style.setProperty('--sy', (40 + seeded(i + 57) * 50).toFixed(0) + '%');
  k.style.setProperty('--yellow', (0.08 + seeded(i + 83) * 0.42).toFixed(2));
});
function setShift(on) {
  shift = on;
  const b = keys.querySelector('[data-act="shift"]');
  b.setAttribute('aria-pressed', on); b.classList.toggle('down', on);
}
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
  else if (act === 'shift') setShift(!shift);
  else {
    const c = b.dataset.char;
    // 注音鍵帽直接打出注音符號（小朋友先學注音）；按「大寫」再按逗點、句點…打標點，打完自動放開
    if (layout !== 'en' && shift && ZY_PUNCT[c]) { enqueue(ZY_PUNCT[c]); setShift(false); }
    else if (layout !== 'en' && ZHUYIN[c]) enqueue(ZHUYIN[c]);
    else enqueue(shift ? c : c.toLowerCase());
  }
});
keys.addEventListener('click', e => {        // 用 Tab 移到鍵上按 Enter／空白時
  if (e.detail !== 0) return;
  const b = e.target.closest('.key'); if (!b) return;
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
});
