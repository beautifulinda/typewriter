// ---------- 練習的判分（純邏輯：不碰畫面、不發聲） ----------
// 注音拆成要按的鍵：聲母韻母照順序，最後是聲調（一聲按空白）
const keysOf = zy => [...zy.replace(/[ˊˇˋ˙]/g, ''), (zy.match(/[ˊˇˋ]$/) || [])[0] || (zy[0] === '˙' ? '˙' : ' ')];
// 第一個按錯的鍵在哪（-1 = 目前都對）
const firstWrong = (typed, want) => typed.findIndex((t, n) => t !== want[n]);
// 按完最後一個鍵（聲調）就交出這個字；交出去時全對才算對，中間打錯但有訂正也算對
const wordDone = (typed, want) => typed.length === want.length;
const wordRight = (typed, want) => wordDone(typed, want) && firstWrong(typed, want) < 0;
// 滿分 100，一個字 100 ÷ 字數 分
const lessonScore = results => Math.round(100 * results.filter(Boolean).length / results.length);
