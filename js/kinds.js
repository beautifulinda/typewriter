// ---------- 字的種類與紙上的編輯（純邏輯：只改 lines、算位置，不碰畫面、不發聲） ----------
// 每種字一筆設定，加新的一種字只要在 KINDS 加一筆，排版、打字、退格都會照著做：
//   is(ch)        這個字是不是這一種（照順序找，第一個符合的算）
//   accepts(c)    打 c 時要不要開這一種字；init(ch, c) 開新字時補上這種字的欄位
//   alone(c)      c 能不能自己開一格（沒寫就是可以）；不行時 c 只能併進上一格，併不進去就打不上去
//   cells()       佔幾格；rows：有這種字的行要幾列高
//   join(ch, c)   打 c 時能不能併進 ch 這一格：回傳 'join'（併進去，要重畫）、'close'（只結束、畫面不變）或 false
//   back(ch)      退格時先從字裡退一部分：退了回傳 true；false 就整個字刪掉
//   ink(ch, g)    要畫哪些筆畫（draw.js 照著畫到螢幕或 canvas）：位置以這一格的中心為 0、單位 px
//                 { s, x, y, size, face, align, role } 是字；{ dot: true, x, y, r, role } 是圓點
//   grid          畫注音練習簿的綠格子，字照 ink 的位置一個一個擺（沒有 grid 的字照一般文字排）
// 存檔的字還是用 ch.zy、ch.w 記種類，舊的草稿不用轉換
const KINDS = [
  {
    name: 'zy',                              // 直式注音音節
    is: ch => !!ch.zy,
    accepts: c => isZy(c),
    alone: c => ZY_PART(c) !== 3,            // 聲調要跟在注音後面，不能單獨一格
    init: (ch, c) => { ch.zy = true; ch.w = 2; },
    cells: () => 3, rows: 2, grid: true,
    ink(ch, g) {
      // 位置照 zyLayout 算（以字高為單位）；聲調掛在最後一個符號右上，輕聲是畫的圓點
      const { syms, tone } = zyParts(ch), z = zyLayout(syms, tone === '˙');
      const size = g.lh * ZY_SIZE, ts = g.lh * ZY_TONE;
      const out = syms.map((s, k) => ({ s, x: 0, y: z.centers[k] * size, size, face: 'cjk', role: 'sym' }));
      if (tone === '˙') out.push({ dot: true, x: 0, y: z.dotY * size, r: ZY_DOT * size, role: 'dot' });
      else if (tone) out.push({ s: tone, x: size / 2 - ts * ZY_TONE_IN, y: z.toneY * size, size: ts, face: 'cjk', align: 'left', role: 'tone' });
      return out;
    },
    join(ch, c) {
      // 注音符號照順序接在同一個音節裡；還沒打聲調時按空白＝一聲，只結束音節、不空一格
      if (zyJoins(ch, c)) { ch.c += c; if (ZY_PART(c) === 3) ch.done = true; return 'join'; }
      if (c === ' ' && !ch.done) { ch.done = true; return 'close'; }
      return false;
    },
    back(ch) {                               // 一次退一個符號
      const s = [...ch.c];
      if (s.length < 2) return false;
      ch.c = s.slice(0, -1).join(''); ch.done = false;
      return true;
    },
  },
  {
    name: 'wide',                            // 國字、全形標點；注音字一個字寬 1.5 個字高，要多一格放注音
    is: ch => ch.w === 2, accepts: isWide,
    cells: () => bpmf ? 3 : 2, rows: 1,
    ink: (ch, g) => [bpmf
      ? { s: glyph(ch), x: 0, y: 0, size: g.fs * 1.15, face: 'bpmf', role: 'sym' }
      : { s: glyph(ch), x: 0, y: 0, size: g.fs * .92, face: 'cjk', role: 'sym' }],
  },
  {
    name: 'narrow',                          // 英文、數字、空白
    is: () => true, accepts: () => true,
    cells: () => 1, rows: 1,
    ink: (ch, g) => [{ s: glyph(ch), x: 0, y: 0, size: g.fs, face: 'type', role: 'sym' }],
  },
];
const kindOf = ch => KINDS.find(k => k.is(ch));

// 打一個字（不含換行）。cols 是一行幾格。回傳畫面要做的事：
//   { join: ch }   併進上一格，ch 要重畫
//   { close: ch }  只結束上一格，畫面不變
//   { add: ch, wrap, grow }  新的一格；wrap：先自動換行了，grow：這一行變高了
//   {}             打不上去（例如單獨的聲調）
function typeInto(ls, c, cols) {
  let line = ls.at(-1);
  const prev = line.at(-1);
  const r = prev && kindOf(prev).join?.(prev, c);
  if (r) return { [r]: prev };
  const kind = KINDS.find(k => k.accepts(c));
  if (kind.alone && !kind.alone(c)) return {};
  const ch = makeChar(c);
  kind.init?.(ch, c);
  // 打到右邊界自動換行（小朋友友善；真正的打字機會卡住）
  const wrap = cellsOf(line) + cells(ch) > cols;
  if (wrap) { ls.push([]); line = ls.at(-1); }
  const before = lineSpan(line);
  line.push(ch);
  return { add: ch, wrap, grow: lineSpan(line) > before };
}
// 換行
const breakLine = ls => { ls.push([]); };
// 退格。回傳畫面要做的事：
//   { shrink: ch }         從字裡退一部分，ch 要重畫
//   { pop: ch, shrunk }    刪掉這一行最後一個字；shrunk：這一行變矮了
//   { unline: true }       這一行是空的，刪掉這一行
//   {}                     已經退到最前面
function backFrom(ls) {
  const line = ls.at(-1), last = line.at(-1);
  if (last && kindOf(last).back?.(last)) return { shrink: last };
  if (line.length) {
    const before = lineSpan(line);
    line.pop();
    return { pop: last, shrunk: lineSpan(line) < before };
  }
  if (ls.length > 1) { ls.pop(); return { unline: true }; }
  return {};
}
