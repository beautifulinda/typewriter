// ---------- 破音字：看前後文自動挑讀音（資料來自 bpmfvs 破音詞庫），也可以點字自己選 ----------
// 第 j 個讀音 = 字後面接異體字選擇子 U+E01E0 + j；第 1 個讀音不用接
const VS = j => j ? String.fromCodePoint(0xE01E0 + j) : '';
const spanOf = new WeakMap(), chOf = new WeakMap();
const glyph = ch => ch.c === ' ' ? ' ' : ch.c + (bpmf ? VS(ch.v || 0) : '');

// ---------- 直式注音音節 ----------
// 連著打的注音符號組成一個音節、佔一格，排成直式：聲母、介音、韻母由上往下，聲調在右邊，輕聲在最上面。
// 字咍注音楷體只會在國字旁邊排注音，單獨的注音符號還是橫著排，所以自己排。
const ZY_PART = c => /[ㄅ-ㄙ]/.test(c) ? 0 : /[ㄧㄨㄩ]/.test(c) ? 1 : /[ㄚ-ㄦ]/.test(c) ? 2 : /[ˊˇˋ˙]/.test(c) ? 3 : -1;
const isZy = c => ZY_PART(c) >= 0;
// 字的大小（行高的倍數）：注音行是兩行高，三個符號 × 0.9 行距 ≈ 1.84 行高，格子上下還留一點空
const ZY_SIZE = .68, ZY_TONE = .5;
// 符號之間的行距；ㄧ 只是一橫、上下空很多，跟前後的符號都再靠近（例如 ㄌㄧㄤ）。
// ㄨ、ㄩ 字形高，再靠近會碰在一起，不另外靠近
const ZY_LH = .85, ZY_TIGHT = .2;
// 第 k 個符號要往上靠幾次（前一個是 ㄧ、自己是 ㄧ 各算一次）
const zyTight = (syms, k) => k > 0 ? (syms[k] === 'ㄧ') + (syms[k - 1] === 'ㄧ') : 0;
// 直排的位置（以字的大小為單位，0 = 整欄中間）：每個符號的中心、整欄高度、聲調的位置（最後一個符號的上緣）
function zyLayout(syms) {
  const tops = []; let y = 0;
  syms.forEach((c, k) => { y -= zyTight(syms, k) * ZY_TIGHT; tops.push(y); y += ZY_LH; });
  // cramped：整欄太高、格子上方空間不夠放輕聲，輕聲要貼近第一個符號（例如 ㄏㄨㄚ˙）
  return { centers: tops.map(t => t + ZY_LH / 2 - y / 2), height: y, toneY: tops[tops.length - 1] - y / 2, cramped: y > 2.25 };
}
// 能不能接在上一個音節後面：要照聲母→介音→韻母→聲調的順序；打了聲調（或空白當一聲）就結束
const zyJoins = (ch, c) => !!ch?.zy && !ch.done && isZy(c) && ZY_PART(c) > Math.max(...[...ch.c].map(ZY_PART));
function zyParts(ch) {
  const s = [...ch.c];
  return { syms: s.filter(c => ZY_PART(c) < 3), tone: s.find(c => ZY_PART(c) === 3) || '' };
}
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
