// ---------- 列印、複製成圖片、存成 PDF ----------
function buildPrint() {
  const g = geo(), host = $('print');
  host.innerHTML = '';
  host.classList.toggle('bpmf', bpmf);
  host.style.setProperty('--fs', g.fs + 'px'); host.style.setProperty('--lh', g.lh + 'px'); host.style.setProperty('--cw', g.cw + 'px');
  const pages = Math.max(1, Math.ceil(lines.length / g.rows));
  for (let p = 0; p < pages; p++) {
    const s = document.createElement('div'); s.className = 'sheet';
    s.appendChild(dateEl(p, 42));
    renderSheet(s, p * g.rows, Math.min(lines.length, (p + 1) * g.rows), g, p * PAGE_H);
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
  const g = geo(), from = p * g.rows, to = Math.min(lines.length, (p + 1) * g.rows);
  const text = lines.slice(from, to).flat().map(ch => ch.c).join('') + pageDate(p);
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
  for (let i = from; i < to; i++) {
    let cx = MARGIN;
    const cy = MARGIN + (i - from) * g.lh + g.lh / 2;
    for (const ch of lines[i]) {
      const w = cells(ch) * g.cw;
      if (ch.c !== ' ') {
        x.save(); x.globalAlpha = ch.o;
        x.translate(cx + w / 2, cy + ch.y); x.rotate(ch.r * Math.PI / 180);
        x.font = ch.w === 2
          ? (bpmf ? `${g.fs * 1.15}px "Bpmf Zihi Kai Std", "Noto Serif TC", serif` : `600 ${g.fs * .92}px "Noto Serif TC", serif`)
          : `${g.fs}px "Special Elite", "Noto Serif TC", monospace`;
        if (ch.zy) {
          // 直式注音：跟螢幕一樣由上往下疊，聲調在右邊
          const { syms, tone } = zyParts(ch), col = tone === '˙' ? ['˙', ...syms] : syms, step = g.fs * .6;
          const side = tone && tone !== '˙';
          x.font = `${step}px "Noto Serif TC", serif`;
          const ox = side ? -step * .3 : 0;
          col.forEach((c, k) => x.fillText(c, ox, (k - (col.length - 1) / 2) * step));
          if (side) x.fillText(tone, ox + step * .85, (syms.length - 2) / 2 * step);
        } else x.fillText(glyph(ch), 0, 0);
        x.restore();
        if (ch.bad) {
          x.save(); x.strokeStyle = '#d42a24'; x.lineWidth = 2; x.globalAlpha = .9;
          x.beginPath(); x.ellipse(cx + w / 2, cy, w * .58, g.lh * .44, -8 * Math.PI / 180, 0, Math.PI * 2); x.stroke(); x.restore();
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
const currentPage = () => Math.floor((lines.length - 1) / geo().rows);
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
    const pages = Math.max(1, Math.ceil(lines.length / geo().rows));
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    for (let p = 0; p < pages; p++) {
      if (p) pdf.addPage();
      pdf.addImage((await sheetCanvas(p, 3)).toDataURL('image/jpeg', .92), 'JPEG', 0, 0, 210, 297);
    }
    pdf.save(`打字機-${todayISO()}.pdf`);
    toast(`已存成 PDF，一共 ${pages} 頁。`);
  } catch { toast('PDF 沒做成功，請檢查網路後再試一次。'); }
}
