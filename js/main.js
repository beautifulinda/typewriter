// ---------- 工具列 ----------
function toast(html, buttons = []) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${html}</span>`;
  buttons.forEach(([label, fn, cls]) => {
    const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls;
    b.onclick = () => { t.remove(); fn?.(); focusTyping(); }; t.appendChild(b);
  });
  document.body.appendChild(t);
  if (!buttons.length) setTimeout(() => t.remove(), 3800);
}
$('big').onclick = e => {
  mode = mode === 'big' ? 'normal' : 'big';
  e.currentTarget.setAttribute('aria-pressed', mode === 'big');
  reflow(); renderAll(); save(); focusTyping();
};
// 換字體大小時，一行能打的格數不同，把太長的行接到下一行
function reflow() {
  const g = geo(), out = [];
  lines.forEach(l => {
    let cur = [];
    l.forEach(ch => { if (cellsOf(cur) + cells(ch) > g.cols) { out.push(cur); cur = []; } cur.push(ch); });
    out.push(cur);
  });
  lines = out.length ? out : [[]];
}
// 切換注音字：國字變寬，一行放不下的接到下一行
$('bpmf').onclick = e => {
  bpmf = !bpmf;
  e.currentTarget.setAttribute('aria-pressed', bpmf);
  paper.classList.toggle('bpmf', bpmf);
  if (bpmf) resolveAll();
  reflow(); renderAll(); save(); focusTyping();
  if (bpmf) document.fonts?.load(`20px "Bpmf Zihi Kai Std"`, '你好').then(() => place(false));
};
$('sound').onclick = e => {
  soundOn = !soundOn;
  e.currentTarget.setAttribute('aria-pressed', soundOn);
  e.currentTarget.textContent = soundOn ? '聲音 開' : '聲音 關';
  focusTyping();
};
const setShell = s => {
  machine.dataset.shell = s;
  $('shell').textContent = s === 'mint' ? '機身 薄荷' : '機身 黑';
};
try { setShell(localStorage.getItem('typewriter:shell') === 'mint' ? 'mint' : 'black'); } catch { setShell('black'); }
$('shell').onclick = () => {
  const s = machine.dataset.shell === 'mint' ? 'black' : 'mint';
  setShell(s);
  try { localStorage.setItem('typewriter:shell', s); } catch {}
  focusTyping();
};
$('fresh').onclick = () => toast('要換一張新紙嗎？現在這張會清掉。', [
  ['換新紙', () => { lines = [[]]; pageDates = []; renderAll(); save(); sounds.ret(); }, 'danger'], ['先不要'],
]);

// ---------- 點破音字選讀音 ----------
const picker = $('picker');
function openPicker(sp, ch) {
  picker.innerHTML = '';
  POYIN[ch.c].forEach(([r], j) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pick' + ((ch.v || 0) === j ? ' on' : '');
    b.setAttribute('aria-label', `${ch.c} 讀 ${r}`);
    b.innerHTML = `<span class="pg">${ch.c + VS(j)}</span><span>${r}</span>`;
    b.onclick = ev => {
      ev.stopPropagation();
      ch.v = j; ch.m = true; sp.textContent = glyph(ch);
      picker.hidden = true; sounds.key(); saveSoon(); focusTyping();
    };
    picker.appendChild(b);
  });
  picker.hidden = false;
  const r = sp.getBoundingClientRect();
  picker.style.left = Math.min(innerWidth - picker.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - picker.offsetWidth / 2)) + 'px';
  picker.style.top = (r.top - picker.offsetHeight - 10 > 8 ? r.top - picker.offsetHeight - 10 : r.bottom + 10) + 'px';
  picker.querySelector('.on')?.focus({ preventScroll: true });
}
paper.addEventListener('click', e => {
  const sp = e.target.closest('.ch.poly'), ch = sp && chOf.get(sp);
  if (!ch || !bpmf) return;
  e.stopPropagation(); audio(); openPicker(sp, ch);
});
document.addEventListener('click', e => { if (!e.target.closest('#picker')) picker.hidden = true; });

// ---------- 全螢幕：瀏覽器支援才顯示（iPhone 的 Safari 不支援） ----------
const fsBtn = $('fullscreen'), root = document.documentElement;
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
if (root.requestFullscreen || root.webkitRequestFullscreen) {
  fsBtn.hidden = false;
  fsBtn.onclick = async () => {
    try {
      if (fsElement()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    } catch { toast('這個畫面不允許切換全螢幕，可以試試用瀏覽器直接打開。'); }
    focusTyping();
  };
  const sync = () => {
    const on = !!fsElement();
    fsBtn.classList.toggle('on', on);
    fsBtn.setAttribute('aria-label', on ? '離開全螢幕' : '全螢幕'); fsBtn.title = on ? '離開全螢幕' : '全螢幕';
    setTimeout(() => place(false), 50);
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
}

// ---------- 開始：有草稿就接著打，沒有就放一張範例紙 ----------
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved?.lines?.length) { lines = saved.lines; mode = saved.mode === 'big' ? 'big' : 'normal'; bpmf = !!saved.bpmf; pageDates = Array.isArray(saved.pageDates) ? saved.pageDates : []; }
} catch {}
if (lines.length === 1 && !lines[0].length) {
  lines = ['（範例）Hello, typewriter!', '', '今天我打了第一封信。', ''].map(s => [...s].map(makeChar));
}
$('big').setAttribute('aria-pressed', mode === 'big');
$('bpmf').setAttribute('aria-pressed', bpmf);
paper.classList.toggle('bpmf', bpmf);
if (bpmf) resolveAll();
document.fonts?.ready.then(() => place(false));
renderAll();
// 矮螢幕：機身和鍵盤等比例縮小，讓整台打字機放得進畫面（最小縮到 55%，再小就讓畫面捲動）
const shellBody = document.querySelector('.body');
function fitScreen() {
  shellBody.style.zoom = 1;
  const top = shellBody.getBoundingClientRect().top + scrollY;
  const room = innerHeight - top - 34;                    // 底下留給狀態列
  shellBody.style.zoom = Math.max(.55, Math.min(1, room / shellBody.offsetHeight)).toFixed(3);
}
addEventListener('resize', () => { fitScreen(); place(false); });
// 工具列換行、練習卡打開或收起時，上面的高度會變
new ResizeObserver(fitScreen).observe(document.querySelector('.bar'));
new ResizeObserver(fitScreen).observe($('lesson'));
fitScreen();
focusTyping();
