// ---------- 列印、複製成圖片、存成 PDF ----------
function buildPrint() {
  const g = geo(), host = $('print');
  host.innerHTML = '';
  host.classList.toggle('bpmf', bpmf);
  host.style.setProperty('--fs', g.fs + 'px'); host.style.setProperty('--lh', g.lh + 'px'); host.style.setProperty('--cw', g.cw + 'px');
  const pages = pageCount();
  for (let p = 0; p < pages; p++) {
    const s = document.createElement('div'); s.className = 'sheet';
    s.appendChild(dateEl(p, 42));
    renderSheet(s, p, g, p * PAGE_H);
    host.appendChild(s);
  }
}
window.addEventListener('beforeprint', buildPrint);
const framed = window.self !== window.top;
$('print-btn').onclick = () => toast('要怎麼帶走這張紙？', [
  ['列印 A4', () => {
    if (framed) { toast('預覽畫面不能開列印視窗。用瀏覽器直接打開這個網頁就可以印成 A4，一頁一張。'); return; }
    buildPrint(); window.print();
  }],
  ['複製成圖片', copyImage],
  ['存成 PDF', savePdf],
  ['取消'],
]);
// 把一頁紙畫到 canvas：位置、墨色、歪斜都跟螢幕上一樣
async function sheetCanvas(p, scale = 2) {
  const g = geo(), L = layoutRows(g);
  const text = lines.filter((_, i) => L[i].page === p).flat().map(ch => ch.c).join('') + pageDate(p);
  await Promise.all([
    document.fonts.load(`${g.fs}px "Special Elite"`, 'Aa1'),
    document.fonts.load('700 64px "Caveat"', '0123456789'),
    document.fonts.load(`600 ${g.fs}px "Noto Serif TC"`, text || '字'),
    bpmf ? document.fonts.load(`${g.fs}px "Bpmf Zihi Kai Std"`, text || '字') : null,
  ]).catch(() => {});
  const c = document.createElement('canvas');
  c.width = PAGE_W * scale; c.height = PAGE_H * scale;
  const x = c.getContext('2d');
  x.scale(scale, scale);
  x.fillStyle = '#fff'; x.fillRect(0, 0, PAGE_W, PAGE_H);
  x.fillStyle = '#23262d'; x.textBaseline = 'middle';
  x.save(); x.textAlign = 'right'; x.globalAlpha = .85; x.font = '15px "Special Elite", "Noto Serif TC", serif';
  x.fillText(pageDate(p), PAGE_W - MARGIN, 52); x.restore();
  x.textAlign = 'center';
  for (let i = 0; i < lines.length; i++) {
    if (L[i].page !== p) continue;
    let cx = MARGIN;
    const top = lineTop(L[i], g) - p * PAGE_H, h = L[i].n * g.lh, cy = top + h / 2;
    for (const ch of lines[i]) {
      const w = cells(ch) * g.cw;
      if (ch.zy) {
        // 注音格子：外框實線、中間虛線十字，不跟著字歪
        x.save(); x.strokeStyle = '#7cbf5a'; x.globalAlpha = .8; x.lineWidth = 1;
        x.strokeRect(cx + .5, top + .5, w - 1, h - 1);
        x.setLineDash([2, 3]); x.beginPath();
        x.moveTo(cx + w / 2, top); x.lineTo(cx + w / 2, top + h);
        x.moveTo(cx, cy); x.lineTo(cx + w, cy); x.stroke(); x.restore();
      }
      if (ch.c !== ' ') {
        x.save(); x.globalAlpha = ch.o;
        x.translate(cx + w / 2, cy + ch.y); x.rotate(ch.r * Math.PI / 180);
        x.font = ch.w === 2
          ? (bpmf ? `${g.fs * 1.15}px "Bpmf Zihi Kai Std", "Noto Serif TC", serif` : `600 ${g.fs * .92}px "Noto Serif TC", serif`)
          : `${g.fs}px "Special Elite", "Noto Serif TC", monospace`;
        if (ch.zy) {
          // 直式注音：跟螢幕一樣由上往下疊，聲調在右邊
          const { syms, tone } = zyParts(ch), z = zyLayout(syms), size = g.lh * ZY_SIZE;
          x.font = `${size}px "Noto Serif TC", serif`;
          syms.forEach((c, k) => x.fillText(c, 0, z.centers[k] * size));
          if (tone === '˙') x.fillText('˙', 0, (-z.height / 2 + (z.cramped ? .13 : -.13)) * size);   // 輕聲在第一個符號上方，不佔一列
          if (tone && tone !== '˙') {
            const ts = g.lh * ZY_TONE;
            x.font = `${ts}px "Noto Serif TC", serif`; x.textAlign = 'left';
            x.fillText(tone, size / 2 - ts * .2, z.toneY * size);
          }
        } else x.fillText(glyph(ch), 0, 0);
        x.restore();
        if (ch.bad) {
          x.save(); x.strokeStyle = '#d42a24'; x.lineWidth = 2; x.globalAlpha = .9;
          x.beginPath(); x.ellipse(cx + w / 2, cy, w * .58, h * .44, -8 * Math.PI / 180, 0, Math.PI * 2); x.stroke(); x.restore();
        }
      }
      if (ch.score != null) {
        x.save(); x.fillStyle = '#d42a24'; x.strokeStyle = '#d42a24'; x.lineWidth = 3;
        x.translate(PAGE_W - MARGIN + 6, cy - 4); x.rotate(-9 * Math.PI / 180);
        x.textAlign = 'left'; x.font = '700 54px "Caveat", cursive'; x.fillText(String(ch.score), 0, 0);
        const tw = x.measureText(String(ch.score)).width;
        x.font = '700 23px "Caveat", "Noto Serif TC", cursive'; x.fillText('分', tw + 2, 7);
        x.beginPath(); x.moveTo(-4, 26); x.lineTo(tw + 34, 24); x.moveTo(-2, 32); x.lineTo(tw + 32, 30); x.stroke();
        x.restore();
      }
      cx += w;
    }
  }
  return c;
}
const currentPage = () => layoutRows().at(-1).page;
const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
function copyImage() {
  const p = currentPage();
  const canvas = sheetCanvas(p);
  // ClipboardItem 直接收 Promise，Safari 才不會因為等字型而拒絕
  Promise.resolve()
    .then(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': canvas.then(toBlob) })]))
    .then(() => toast(`已複製第 ${p + 1} 頁的圖片，可以貼到 LINE、Word 或備忘錄。`))
    .catch(async () => { $('shot-img').src = (await canvas).toDataURL('image/png'); $('shot').hidden = false; });
}
$('shot-close').onclick = () => { $('shot').hidden = true; focusTyping(); };
async function savePdf() {
  if (framed) { toast('預覽畫面不能下載檔案。用瀏覽器直接打開這個網頁就可以存成 PDF；或先用「複製成圖片」。'); return; }
  toast('正在做 PDF…');
  try {
    if (!window.jspdf) await new Promise((ok, no) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      sc.onload = ok; sc.onerror = no; document.head.appendChild(sc);
    });
    const pages = pageCount();
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    for (let p = 0; p < pages; p++) {
      if (p) pdf.addPage();
      pdf.addImage((await sheetCanvas(p, 3)).toDataURL('image/jpeg', .92), 'JPEG', 0, 0, 210, 297);
    }
    pdf.save(`打字機-${todayISO()}.pdf`);
    toast(`已存成 PDF，一共 ${pages} 頁。`);
  } catch { toast('PDF 沒做成功，請檢查網路後再試一次。'); }
}
