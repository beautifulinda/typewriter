// ---------- 測試：網址加上 ?test 打開 index.html 就會跑（例如 index.html?test） ----------
// 跟網頁共用同一份程式與畫面，所以測得到真的鍵盤事件、紙張排版與按鈕。
// 跑測試時不寫入瀏覽器存檔（localStorage），打到一半的內容不會被蓋掉；跑完請回到打字機重新整理。

// 擋掉存檔：打字機自己的 key 一律不寫
const realSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (k, v) { if (!String(k).startsWith('typewriter:')) realSetItem.call(this, k, v); };
soundOn = false;

const TESTS = [];
const test = (group, name, fn) => TESTS.push({ group, name, fn });
function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}預期 ${b}，實際 ${a}`);
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------- 小工具 ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
// 等打字佇列打完（enqueue 是一個字一個字慢慢打）
async function idle() { while (draining || queue.length) await wait(20); }
// 每個測試前回到乾淨的狀態：一張空白紙、大字、沒有練習、ㄅㄆㄇ 模式
function reset({ big = true, keyLayout = 'zhuyin' } = {}) {
  if (practice) endPractice();
  queue.length = 0;
  lines = [[]]; pageDates = [];
  mode = big ? 'big' : 'normal';
  if (bpmf) $('bpmf').click();
  setLayout(keyLayout); setShift(false);
  document.activeElement?.blur?.();
  renderAll();
}
const type = s => { for (const c of s) c === '\n' ? newLine(false) : typeChar(c); };
const text = () => lines.map(l => l.map(ch => ch.c));
const lastLine = () => text().at(-1);
// 送出實體鍵盤的按鍵（e.code 是按鍵位置，跟真的鍵盤一樣）
function press(code, { shift = false, key = '', target = document.body } = {}) {
  const e = new KeyboardEvent('keydown', { code, key, shiftKey: shift, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}
const tap = sel => keys.querySelector(sel).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

// ---------- 注音合併成音節 ----------
test('注音音節', 'ㄅㄚˋ 合成一格，打了聲調就結束', () => {
  reset(); type('ㄅㄚˋ');
  eq(lastLine(), ['ㄅㄚˋ']); ok(lines[0][0].done, '應該已結束');
});
test('注音音節', '輕聲 ㄅㄚ˙', () => { reset(); type('ㄅㄚ˙'); eq(lastLine(), ['ㄅㄚ˙']); });
test('注音音節', '還沒打聲調時按空白＝一聲，不空一格', () => {
  reset(); type('ㄅㄚ ㄅㄚˋ'); eq(lastLine(), ['ㄅㄚ', 'ㄅㄚˋ']);
});
test('注音音節', '打完聲調再按空白才空一格', () => { reset(); type('ㄅㄚˋ ㄇ'); eq(lastLine(), ['ㄅㄚˋ', ' ', 'ㄇ']); });
test('注音音節', '順序不對（韻母後面打聲母）就開新的一格', () => { reset(); type('ㄚㄅ'); eq(lastLine(), ['ㄚ', 'ㄅ']); });
test('注音音節', '三個符號 ㄒㄧㄠˇ 合成一格', () => { reset(); type('ㄒㄧㄠˇ'); eq(lastLine(), ['ㄒㄧㄠˇ']); });
test('注音音節', '退格一次退一個符號，退完可以接著打', () => {
  reset(); type('ㄒㄧㄠ'); backspace(); eq(lastLine(), ['ㄒㄧ']);
  type('ㄤ'); eq(lastLine(), ['ㄒㄧㄤ']);
});
test('注音音節', '退掉聲調可以換一個聲調', () => {
  reset(); type('ㄅㄚˋ'); backspace(); eq(lastLine(), ['ㄅㄚ']); type('ˇ'); eq(lastLine(), ['ㄅㄚˇ']);
});
test('注音音節', '國字後面的注音不會合在一起', () => { reset(); type('我ㄅ'); eq(lastLine(), ['我', 'ㄅ']); });

// ---------- 紙張排版 ----------
test('排版', '注音音節佔 3 格、有注音的行佔兩行高', () => {
  reset(); type('ㄅㄚˋ'); eq(cells(lines[0][0]), 3); eq(lineSpan(lines[0]), 2);
  type('\nab'); eq(lineSpan(lines[1]), 1);
});
test('排版', '注音行放不下就整行換到下一頁，不跨頁', () => {
  reset(); const g = geo();
  for (let i = 0; i < g.rows - 1; i++) type('a\n');        // 第一頁只剩最後一列
  type('ㄅㄚˋ');
  eq(layoutRows(g).at(-1), { page: 1, row: 0, n: 2 });
});
test('排版', '一般的行剛好排滿一頁', () => {
  reset(); const g = geo();
  for (let i = 0; i < g.rows; i++) type('a\n');
  eq(layoutRows(g).at(-1), { page: 1, row: 0, n: 1 });
});

// ---------- ㄅㄆㄇ 模式的實體鍵盤 ----------
test('ㄅㄆㄇ 鍵盤', '按鍵位置打出注音（1 8 4 ＝ ㄅㄚˋ）', async () => {
  reset(); press('Digit1'); press('Digit8'); press('Digit4'); await idle();
  eq(lastLine(), ['ㄅㄚˋ']);
});
test('ㄅㄆㄇ 鍵盤', 'Shift 打全形標點，沒按 Shift 是注音', async () => {
  reset();
  press('Comma', { shift: true }); press('Comma'); press('Period', { shift: true }); press('Period');
  press('Slash', { shift: true }); press('Slash'); press('Digit1', { shift: true }); press('Semicolon', { shift: true });
  await idle();
  eq(lastLine(), ['，', 'ㄝ', '。', 'ㄡ', '？', 'ㄥ', '！', '：']);
});
test('ㄅㄆㄇ 鍵盤', 'Enter 換行、Backspace 退格', async () => {
  reset(); press('Digit1'); press('Enter'); press('Digit8'); await idle();
  eq(text(), [['ㄅ'], ['ㄚ']]);
  press('Backspace'); press('Backspace'); await idle();
  eq(text(), [['ㄅ']]);
});
test('ㄅㄆㄇ 鍵盤', '點完「ㄅㄆㄇ」按鈕後，焦點不會留在按鈕上（Enter 才打得上紙）', async () => {
  reset({ keyLayout: 'en' });
  const b = document.querySelector('[data-layout="zhuyin"]');
  b.focus(); b.click();
  ok(document.activeElement !== b, '焦點還在按鈕上');
  press('Enter', { target: document.activeElement || document.body }); await idle();
  eq(lines.length, 2, '行數：');
});
test('ㄅㄆㄇ 鍵盤', '畫面圓鍵：按「大寫」再按句點打出「。」，大寫自動放開', async () => {
  reset(); tap('[data-act="shift"]'); tap('[data-char="."]'); tap('[data-char="."]'); await idle();
  eq(lastLine(), ['。', 'ㄡ']); eq(shift, false, '大寫：');
});

// ---------- 練習計分 ----------
// 照課文把每個字的鍵按一遍；wrongAt 是要打錯的第幾個字，fix 表示打錯後先退格訂正
function playLesson(id, { wrongAt = -1, fix = false } = {}) {
  startLesson(id);
  practice.lesson.items.forEach(([, zy], n) => {
    if (!zy) return;
    const ks = keysOf(zy);
    if (n === wrongAt) {
      practiceInput(ks[0] === 'ㄅ' ? 'ㄆ' : 'ㄅ');          // 第一個鍵打錯
      if (fix) practiceUndo(); else { ks.slice(1).forEach(practiceInput); return; }
    }
    ks.forEach(practiceInput);
  });
}
test('練習計分', '全對 100 分', () => {
  reset(); playLesson('f1'); ok(practice.done, '應該打完了'); eq(practice.score, 100);
});
test('練習計分', '錯一個字沒訂正：90 分，紙上那個字畫紅圈', () => {
  reset(); playLesson('f1', { wrongAt: 3 });
  eq(practice.score, 90);
  eq(lines.flat().filter(ch => ch.bad).map(ch => ch.c), ['鞋']);
});
test('練習計分', '打錯但交出去前有訂正：還是 100 分', () => {
  reset(); playLesson('f1', { wrongAt: 3, fix: true }); eq(practice.score, 100);
});
test('練習計分', '小文章的標點自動打上去，不算分', () => {
  reset(); playLesson('s1'); eq(practice.score, 100);
  ok(lines.flat().some(ch => ch.c === '，'), '逗點應該自動打上去');
});

// ---------- 直式注音的位置 ----------
test('注音位置', 'ㄅㄚ˙ 和 ㄅㄚˋ 的 ㄅ、ㄚ 同高度', () => {
  eq(zyLayout(['ㄅ', 'ㄚ'], true).centers, zyLayout(['ㄅ', 'ㄚ']).centers);
});
// 所有聲母（含沒有聲母）× 韻母（單韻母、結合韻）× 聲調，實際畫在 canvas 上量筆畫：
// 聲調／輕聲點不能碰到或貼太近注音，所有筆畫不能超出格子
test('注音位置', '3344 種組合都不碰字、不超出格子', async () => {
  await document.fonts.load('100px "Noto Serif TC"', 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ');
  const S = 100, BH = 2 / ZY_SIZE * S, BW = (3 * .6) / (ZY_SIZE * 1.5) * S, TS = ZY_TONE / ZY_SIZE * S;
  // 跟注音筆畫至少要隔幾 px（字高 100px 時）：輕聲點目前最近約 16px、聲調最近約 8px（ㄓㄧˊ），低於這個就算貼在一起
  const DOT_GAP = 12, TONE_GAP = 4;
  const W = Math.ceil(BW) + 80, H = Math.ceil(BH) + 80, ox = W / 2, oy = H / 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.textAlign = 'center'; x.textBaseline = 'middle'; return x; };
  const a = mk(), b = mk();
  const inits = ['', ...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ'];
  const finals = [...'ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦㄧㄨㄩ', 'ㄧㄚ', 'ㄧㄛ', 'ㄧㄝ', 'ㄧㄞ', 'ㄧㄠ', 'ㄧㄡ', 'ㄧㄢ', 'ㄧㄣ', 'ㄧㄤ', 'ㄧㄥ',
    'ㄨㄚ', 'ㄨㄛ', 'ㄨㄞ', 'ㄨㄟ', 'ㄨㄢ', 'ㄨㄣ', 'ㄨㄤ', 'ㄨㄥ', 'ㄩㄝ', 'ㄩㄢ', 'ㄩㄣ', 'ㄩㄥ'];
  const box = [ox - BW / 2 + 2, oy - BH / 2 + 2, ox + BW / 2 - 2, oy + BH / 2 - 2];
  const inside = D => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[(y * W + x) * 4 + 3] > 60 && (x < box[0] || x > box[2] || y < box[1] || y > box[3])) return false; return true; };
  const bad = []; let n = 0;
  for (const i of inits) for (const f of finals) for (const tone of ['˙', 'ˊ', 'ˇ', 'ˋ']) {
    const syms = [...(i + f)], z = zyLayout(syms, tone === '˙'); n++;
    a.clearRect(0, 0, W, H); b.clearRect(0, 0, W, H);
    a.font = `${S}px "Noto Serif TC"`; syms.forEach((s, k) => a.fillText(s, ox, oy + z.centers[k] * S));
    if (tone === '˙') { b.beginPath(); b.arc(ox, oy + z.dotY * S, ZY_DOT * S, 0, 7); b.fill(); }
    else { b.font = `${TS}px "Noto Serif TC"`; b.textAlign = 'left'; b.fillText(tone, ox + S / 2 - TS * .2, oy + z.toneY * S); b.textAlign = 'center'; }
    const A = a.getImageData(0, 0, W, H).data, B = b.getImageData(0, 0, W, H).data;
    let touch = false; const M = tone === '˙' ? DOT_GAP : TONE_GAP;
    for (let y = M; y < H - M && !touch; y++) for (let x = M; x < W - M && !touch; x++) {
      if (B[(y * W + x) * 4 + 3] <= 60) continue;
      for (let dy = -M; dy <= M && !touch; dy++) for (let dx = -M; dx <= M; dx++) if (A[((y + dy) * W + x + dx) * 4 + 3] > 60) { touch = true; break; }
    }
    if (touch || !inside(A) || !inside(B)) bad.push(i + f + tone + (touch ? '（太近）' : '（超出格子）'));
  }
  eq(n, 3344, '組合數：');
  ok(!bad.length, `${bad.length} 種有問題：${bad.slice(0, 10).join('、')}`);
});

// ---------- 執行與顯示結果 ----------
async function runTests() {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99;width:min(460px,calc(100% - 16px));max-height:calc(100% - 16px);overflow:auto;'
    + 'background:#fff;color:#23262d;font:13px/1.6 "Noto Sans TC",sans-serif;border-radius:12px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  panel.innerHTML = '<b>測試中…</b>';
  document.body.appendChild(panel);
  const results = [];
  for (const t of TESTS) {
    try { await t.fn(); results.push({ ...t, pass: true }); }
    catch (err) { results.push({ ...t, pass: false, err: err.message }); console.error(`✗ ${t.group}：${t.name}`, err); }
  }
  if (practice) endPractice();
  const failed = results.filter(r => !r.pass);
  window.testResults = { total: results.length, failed: failed.map(r => `${r.group}：${r.name}：${r.err}`) };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  let html = `<b style="font-size:15px;color:${failed.length ? '#c4372c' : '#2f6b5c'}">${failed.length ? `✗ ${failed.length} 個失敗` : '✓ 全部通過'}（共 ${results.length} 個）</b>`
    + ` <a href="${location.pathname}" style="margin-left:8px">回到打字機</a>`;
  let group = '';
  for (const r of results) {
    if (r.group !== group) { group = r.group; html += `<div style="margin-top:8px;font-weight:700">${esc(group)}</div>`; }
    html += `<div style="color:${r.pass ? '#2f6b5c' : '#c4372c'}">${r.pass ? '✓' : '✗'} ${esc(r.name)}${r.pass ? '' : `<br><small>${esc(r.err)}</small>`}</div>`;
  }
  panel.innerHTML = html;
  console.log(failed.length ? `測試：${failed.length}／${results.length} 個失敗` : `測試：${results.length} 個全部通過`);
}
runTests();
