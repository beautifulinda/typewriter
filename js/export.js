// ---------- 列印、複製成圖片、存成 PDF ----------
function buildPrint() {
  const g = geo(), host = $('print');
  host.innerHTML = '';
  host.classList.toggle('bpmf', bpmf);
  host.style.setProperty('--lh', g.lh + 'px');
  const pages = pageCount();
  for (let p = 0; p < pages; p++) {
    const s = document.createElement('div'); s.className = 'sheet';
    s.appendChild(dateEl(p, 0));
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
// 把一頁紙畫到 canvas：每個字用 draw.js 的 drawChar，位置、墨色、歪斜都跟螢幕上一樣
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
  drawDate(x, p);
  for (let i = 0; i < lines.length; i++) {
    if (L[i].page !== p) continue;
    let cx = MARGIN;
    const top = lineTop(L[i], g) - p * PAGE_H, h = L[i].n * g.lh;
    for (const ch of lines[i]) {
      drawChar(x, ch, g, cx, top, h);
      if (ch.score != null) drawScore(x, ch.score, top);
      cx += cells(ch) * g.cw;
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
