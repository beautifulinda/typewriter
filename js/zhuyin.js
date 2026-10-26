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
// 字的大小（行高的倍數）：注音行是兩行高，三個符號直排放得下，格子上下還留一點空
const ZY_SIZE = .68, ZY_TONE = .5;
// 聲調左邊往注音那一欄靠進去多少（聲調字高的倍數）
const ZY_TONE_IN = .2;
// 聲調掛在最後一個符號的右上：中心比那個符號的上緣再往下多少（像課本那樣）
const ZY_TONE_DROP = .25;
// 符號之間的行距；ㄧ 只是一橫、上下空很多，跟前後的符號都再靠近（例如 ㄌㄧㄤ）。
// ㄨ、ㄩ 字形高，再靠近會碰在一起，不另外靠近
const ZY_LH = .85, ZY_TIGHT = .2;
// 第 k 個符號要往上靠幾次（前一個是 ㄧ、自己是 ㄧ 各算一次）
const zyTight = (syms, k) => k > 0 ? (syms[k] === 'ㄧ') + (syms[k - 1] === 'ㄧ') : 0;
// 輕聲是畫的圓點（字型裡的 ˙ 位置算不準）：半徑、跟第一個符號的距離、離格子上緣至少多遠
const ZY_DOT = .07, ZY_DOT_GAP = .12, ZY_DOT_EDGE = .14;   // 用所有聲母×韻母組合實際量筆畫調出來的
// 直排的位置，螢幕和圖片／PDF 共用（以字的大小為單位，0 = 格子正中，往下是正）：
// 每個符號的中心、聲調的中心（最後一個符號的右上）、輕聲圓點的中心
function zyLayout(syms, light = false) {
  const tops = []; let y = 0;
  syms.forEach((c, k) => { y -= zyTight(syms, k) * ZY_TIGHT; tops.push(y); y += ZY_LH; });
  let top = -y / 2, dotY = null;
  if (light) {
    // 輕聲不佔一列，放在第一個符號上方的空白；空白不夠（例如 ㄏㄨㄚ˙）整欄才往下挪剛好放得下的距離
    const edge = -1 / ZY_SIZE + ZY_DOT_EDGE;        // 格子上緣（格子兩行高 = 2 / ZY_SIZE 個字高）
    top += Math.max(0, edge - (top - ZY_DOT_GAP));
    dotY = top - ZY_DOT_GAP;
  }
  return { centers: tops.map(t => top + t + ZY_LH / 2), toneY: top + tops[tops.length - 1] + ZY_TONE_DROP, dotY };
}
// 國語有的音節（不含聲調）：每個聲母後面列能接的韻母，'-' 是聲母單獨成音（ㄓ、ㄗ…）
// 拼不出來的組合（ㄗㄧ、ㄧㄟ、ㄅㄨㄛ、ㄐㄨ、ㄈㄧ…）不併成一格
const ZY_BPM = 'ㄚ ㄛ ㄞ ㄟ ㄠ ㄢ ㄣ ㄤ ㄥ ㄧ ㄧㄝ ㄧㄠ ㄧㄢ ㄧㄣ ㄧㄥ ㄨ';
const ZY_GKH = 'ㄚ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄨ ㄨㄚ ㄨㄛ ㄨㄞ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄤ ㄨㄥ';
const ZY_JQX = 'ㄧ ㄧㄚ ㄧㄝ ㄧㄠ ㄧㄡ ㄧㄢ ㄧㄣ ㄧㄤ ㄧㄥ ㄩ ㄩㄝ ㄩㄢ ㄩㄣ ㄩㄥ';
const ZY_ZCS = '- ㄚ ㄜ ㄞ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄨ ㄨㄛ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄥ';
const ZY_SYLLABLES = {
  '': 'ㄚ ㄛ ㄜ ㄝ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄦ ㄧ ㄧㄚ ㄧㄛ ㄧㄝ ㄧㄞ ㄧㄠ ㄧㄡ ㄧㄢ ㄧㄣ ㄧㄤ ㄧㄥ ㄨ ㄨㄚ ㄨㄛ ㄨㄞ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄤ ㄨㄥ ㄩ ㄩㄝ ㄩㄢ ㄩㄣ ㄩㄥ',
  ㄅ: ZY_BPM, ㄆ: ZY_BPM + ' ㄡ', ㄇ: ZY_BPM + ' ㄜ ㄡ ㄧㄡ', ㄈ: 'ㄚ ㄛ ㄟ ㄡ ㄢ ㄣ ㄤ ㄥ ㄨ',
  ㄉ: 'ㄚ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄧ ㄧㄚ ㄧㄝ ㄧㄠ ㄧㄡ ㄧㄢ ㄧㄤ ㄧㄥ ㄨ ㄨㄛ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄥ',
  ㄊ: 'ㄚ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄤ ㄥ ㄧ ㄧㄝ ㄧㄠ ㄧㄢ ㄧㄥ ㄨ ㄨㄛ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄥ',
  ㄋ: 'ㄚ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄧ ㄧㄚ ㄧㄝ ㄧㄠ ㄧㄡ ㄧㄢ ㄧㄣ ㄧㄤ ㄧㄥ ㄨ ㄨㄛ ㄨㄢ ㄨㄣ ㄨㄥ ㄩ ㄩㄝ',
  ㄌ: 'ㄚ ㄛ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄤ ㄥ ㄧ ㄧㄚ ㄧㄝ ㄧㄠ ㄧㄡ ㄧㄢ ㄧㄣ ㄧㄤ ㄧㄥ ㄨ ㄨㄛ ㄨㄢ ㄨㄣ ㄨㄥ ㄩ ㄩㄝ ㄩㄢ',
  ㄍ: ZY_GKH, ㄎ: ZY_GKH, ㄏ: ZY_GKH,
  ㄐ: ZY_JQX, ㄑ: ZY_JQX, ㄒ: ZY_JQX,
  ㄓ: '- ' + ZY_GKH,
  ㄔ: '- ㄚ ㄜ ㄞ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄨ ㄨㄚ ㄨㄛ ㄨㄞ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄤ ㄨㄥ',
  ㄕ: '- ㄚ ㄜ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄨ ㄨㄚ ㄨㄛ ㄨㄞ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄤ',
  ㄖ: '- ㄜ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄨ ㄨㄛ ㄨㄟ ㄨㄢ ㄨㄣ ㄨㄥ',
  ㄗ: ZY_ZCS + ' ㄟ', ㄘ: ZY_ZCS, ㄙ: ZY_ZCS,
};
// 拼到一半也要接得上：存所有音節的開頭（ㄉ、ㄉㄨ、ㄉㄨㄛ…）
const ZY_PREFIX = new Set();
for (const [i, fs] of Object.entries(ZY_SYLLABLES)) for (const f of fs.split(' ')) {
  const s = [...i + (f === '-' ? '' : f)];
  s.forEach((_, k) => ZY_PREFIX.add(s.slice(0, k + 1).join('')));
}
// 能不能接在上一個音節後面：接上去要還是某個音節的開頭（順序不對、拼不出來都不行）；
// 聲調接在任何還沒結束的音節後面；打了聲調（或空白當一聲）就結束
const zyJoins = (ch, c) => !!ch?.zy && !ch.done && isZy(c) && (ZY_PART(c) === 3 || ZY_PREFIX.has(ch.c + c));
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
// 注音鍵盤的標點：逗點、句點這些鍵被注音占走了，跟電腦的注音輸入法一樣按 Shift 打標點
const ZY_PUNCT = { ',': '，', '.': '。', '?': '？', '1': '！', ';': '：' };
