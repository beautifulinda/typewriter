# 小小打字機

一台在瀏覽器裡的復古打字機，大人小孩都喜愛：按鍵有打字聲、換行會「叮」，打好的內容可以印成 A4。

## 功能

- **打字機的手感**：紙捲在滾筒上，滑架跟著字往左移，換行時滑回來再叮一聲；字錘、色帶、墨色深淺與歪斜都模擬真的打字機。聲音全部用 Web Audio 現場合成，不需要音檔。
- **外觀**：氧化鍍鉻圓鍵、泛黃字面；機身有消光黑與薄荷綠可以切換。
- **注音**
  - 三種輸入：「ABC」打英文；「ㄅㄆㄇ」直接打注音符號，不會選成國字，一個音節照課本排成直式（適合剛學注音的小朋友，電腦輸入法是英文也行）；標點跟注音輸入法一樣用 Shift＋逗點、句點；「國字」用電腦的注音輸入法選字，偵測到注音輸入法會自動切過來。鍵盤是標準注音配置。
  - 「注音字」：國字旁邊帶注音（字咍注音楷體）。破音字依前後文自動挑讀音，也可以點字自己選。
- **練習模式**：結合韻（ㄧ、ㄨ、ㄩ）與小文章，跟著提示一個鍵一個鍵打。打錯可以按退格訂正，沒訂正才扣分；打完在紙上用紅筆寫分數、圈出錯字。
- **帶走這張紙**：列印 A4、複製成圖片、存成 PDF。每一頁最上方印著開始打的日期。
- 大字模式、全螢幕、打到一半的內容存在瀏覽器裡（不上傳）。

## 使用

雙擊 `index.html` 用瀏覽器打開就可以用，不需要安裝任何東西。

字型（Special Elite、Noto Serif TC、字咍注音楷體、Caveat）從 Google Fonts 載入，存 PDF 時從 cdnjs 載入 jsPDF，所以第一次使用需要連網。

## 檔案

```
index.html          畫面結構
style.css           外觀（機身、鍵帽、紙張、練習卡）
js/                 照 index.html 的順序載入，共用最上層的變數
  state.js          共用設定、狀態、紙張格子計算、日期
  zhuyin.js         破音字判斷、注音鍵盤配置
  sound.js          打字聲、鈴聲（Web Audio 合成）
  paper.js          紙張排版、滑架、打字與換行
  keyboard.js       實體鍵盤、輸入法、畫面上的圓鍵
  export.js         列印、複製成圖片、存成 PDF
  practice.js       練習模式與計分
  main.js           工具列、選讀音、全螢幕、開始
data/
  lessons.js        練習課文（加新課改這個檔）
  poyin.js          破音詞庫（由 scripts/build-poyin.mjs 產生）
scripts/
  build-poyin.mjs   從 bpmfvs 重新產生破音詞庫
tests/
  run.js            測試（網址加 ?test 才會載入）
licenses/           第三方授權
```

沒有用建置工具：改完存檔、重新整理瀏覽器就看得到。

## 測試

打開 `index.html` 後在網址最後加上 `?test`（例如 `index.html?test`），會在同一個頁面跑測試，右上角列出結果。不需要安裝任何東西。

- 測試內容：注音合併成音節、紙張排版與分頁、ㄅㄆㄇ 模式的按鍵與標點、練習計分、直式注音的位置（3344 種聲母×韻母×聲調組合，量筆畫確認不碰字、不出格）
- 跑測試時不會寫入瀏覽器存檔，打到一半的內容不受影響；跑完按「回到打字機」
- 加新功能或修 bug 時，在 `tests/run.js` 用 `test(分類, 名稱, 函式)` 加一筆

## 加練習課文

在 `data/lessons.js` 照格式加一筆：

```js
{ id: 's6', name: '小文章：下雨', text: '雲兒飄呀飄…', zy: ['ㄩㄣˊ', …] },
```

`zy` 跟 `text` 一個字對一個字，標點寫 `null`，一聲不寫聲調。破音字照這裡寫的讀音印，不靠自動判斷。

## 重新產生破音詞庫

```
node scripts/build-poyin.mjs
```

需要 Node 18 以上（用內建的 `fetch`）。

## 授權與出處

- 破音詞庫與注音 IVS 規格：[ButTaiwan/bpmfvs](https://github.com/ButTaiwan/bpmfvs)，Apache License 2.0（見 `licenses/`）。
- 字型：字咍注音楷體（Bpmf Zihi Kai Std）、Special Elite、Noto Serif TC、Caveat，皆由 Google Fonts 提供，SIL Open Font License。
- jsPDF：MIT License，從 cdnjs 載入。
