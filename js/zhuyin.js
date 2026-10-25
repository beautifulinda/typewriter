// ---------- 破音字：看前後文自動挑讀音（資料來自 bpmfvs 破音詞庫），也可以點字自己選 ----------
// 第 j 個讀音 = 字後面接異體字選擇子 U+E01E0 + j；第 1 個讀音不用接
const VS = j => j ? String.fromCodePoint(0xE01E0 + j) : '';
const spanOf = new WeakMap(), chOf = new WeakMap();
const glyph = ch => ch.c === ' ' ? ' ' : ch.c + (bpmf ? VS(ch.v || 0) : '');
// 詞庫的詞用 * 代表這個字，例如「銀*」「*列」；挑前後文對得上、最長的那個詞
function guessReading(text, i) {
  const c = text[i];
  let best = 0, bestLen = 0;
  POYIN[c].forEach(([, pats], j) => {
    for (const p of pats) {
      if (p.length <= bestLen) continue;
      const word = p.replaceAll('*', c);
      for (let s = 0; s < p.length; s++) {
        if (p[s] !== '*') continue;
        const start = i - s;
        if (start < 0 || start + word.length > text.length) continue;
        let ok = true;
        for (let k = 0; k < word.length; k++) if (text[start + k] !== word[k]) { ok = false; break; }
        if (ok) { best = j; bestLen = p.length; break; }
      }
    }
  });
  return best;
}
// 自己選過的字（m）不再自動改
function resolve(from) {
  const flat = lines.flat(), text = flat.map(ch => ch.c);
  for (let k = Math.max(0, from); k < flat.length; k++) {
    const ch = flat[k];
    if (ch.m || !POYIN[ch.c]) continue;
    const v = guessReading(text, k);
    if (v !== (ch.v || 0)) { ch.v = v; const sp = spanOf.get(ch); if (sp) sp.textContent = glyph(ch); }
  }
}
const resolveAll = () => resolve(0);
// 「行」打完時還不知道後面是不是「列」，所以每打一個字就回頭重看最後幾個字
const resolveAround = () => { if (bpmf) resolve(lines.reduce((n, l) => n + l.length, 0) - 8); };

// 標準注音（大千）鍵盤配置，跟電腦的注音輸入法一樣
const ZHUYIN = {
  '1': 'ㄅ', '2': 'ㄉ', '3': 'ˇ', '4': 'ˋ', '5': 'ㄓ', '6': 'ˊ', '7': '˙', '8': 'ㄚ', '9': 'ㄞ', '0': 'ㄢ', '-': 'ㄦ',
  Q: 'ㄆ', W: 'ㄊ', E: 'ㄍ', R: 'ㄐ', T: 'ㄔ', Y: 'ㄗ', U: 'ㄧ', I: 'ㄛ', O: 'ㄟ', P: 'ㄣ',
  A: 'ㄇ', S: 'ㄋ', D: 'ㄎ', F: 'ㄑ', G: 'ㄕ', H: 'ㄘ', J: 'ㄨ', K: 'ㄜ', L: 'ㄠ', ';': 'ㄤ',
  Z: 'ㄈ', X: 'ㄌ', C: 'ㄏ', V: 'ㄒ', B: 'ㄖ', N: 'ㄙ', M: 'ㄩ', ',': 'ㄝ', '.': 'ㄡ', '?': 'ㄥ',
};
