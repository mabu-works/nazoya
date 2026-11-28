'use strict';

// ==========================================
// 🧩 nazoya — 画面配線（変換そのものは js/cipher-core.js）
// ==========================================

const {
  METHOD_NAMES,
  convert
} = window.NazoyaCore;

const $ = (id) => document.getElementById(id);
const inputEl = $('input-text');
const outputEl = $('output-text');
const methodEl = $('method');
const shiftEl = $('shift');
const shiftWrap = $('shift-wrap');
const hintEl = $('hint-text');
const statusEl = $('status');

// 💬 ステータス表示を更新する
function setStatus(msg) { statusEl.textContent = msg; }

// 🔢 シーザー暗号のずらし幅を返す（数値化できない場合は既定の 3）
function currentShift() {
  const v = parseInt(shiftEl.value, 10);
  return Number.isFinite(v) ? v : 3;
}

// 👁️ ずらし幅の入力はシーザー暗号のときだけ見せる
function updateShiftVisibility() {
  shiftWrap.style.display = methodEl.value === 'caesar' ? '' : 'none';
}
methodEl.addEventListener('change', updateShiftVisibility);
updateShiftVisibility();

// 🔐 暗号化ボタン
$('btn-encrypt').addEventListener('click', () => {
  if (!inputEl.value) { setStatus('元の文章を入力してください。'); return; }
  outputEl.value = convert(inputEl.value, methodEl.value, currentShift(), false);
  setStatus(METHOD_NAMES[methodEl.value] + 'で暗号化しました。');
});

// 🔓 復号ボタン
$('btn-decrypt').addEventListener('click', () => {
  if (!inputEl.value) { setStatus('復号したい文章を入力してください。'); return; }
  outputEl.value = convert(inputEl.value, methodEl.value, currentShift(), true);
  setStatus(METHOD_NAMES[methodEl.value] + 'で復号しました。');
});

// 🔁 入力と出力の入れ替え
$('btn-swap').addEventListener('click', () => {
  const tmp = inputEl.value;
  inputEl.value = outputEl.value;
  outputEl.value = tmp;
  setStatus('入力と出力を入れ替えました。');
});

// 📋 結果のコピー（Clipboard API が使えない環境では選択＋execCommand にフォールバック）
$('btn-copy').addEventListener('click', async () => {
  if (!outputEl.value) { setStatus('コピーする結果がありません。'); return; }
  try {
    await navigator.clipboard.writeText(outputEl.value);
    setStatus('結果をコピーしました。');
  } catch (e) {
    outputEl.select();
    document.execCommand('copy');
    setStatus('結果をコピーしました。');
  }
});

// ==========================================
// 🃏 問題カード（Canvas 1200×630）
// ==========================================

// 📝 描画幅に合わせてテキストを折り返す（段落＝改行は保持する）
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const ch of Array.from(paragraph)) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

// 🃏 問題カードを描く。載せるのは暗号文・方式名・ヒントのみ（答えは含めない）
function drawCard(problemText, methodName, hint) {
  const canvas = $('card-canvas');
  const ctx = canvas.getContext('2d');
  const W = 1200, H = 630;

  // 🎨 背景・上部の帯・枠
  ctx.fillStyle = '#232338';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4338ca';
  ctx.fillRect(0, 0, W, 14);
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // 🏷️ 見出しと方式名
  ctx.fillStyle = '#a5b4fc';
  ctx.font = '700 30px sans-serif';
  ctx.fillText('なぞとき問題カード', 64, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px sans-serif';
  ctx.fillText('方式：' + methodName, 64, 148);

  // 📖 問題文（最大7行。7行目の下端が約474に収まるよう開始206・行間44）
  ctx.font = '40px sans-serif';
  const lines = wrapText(ctx, problemText, W - 128).slice(0, 7);
  let y = 206;
  for (const line of lines) {
    ctx.fillText(line, 64, y);
    y += 44;
  }

  // 💡 ヒント欄（488〜552 の帯に1行だけ）
  if (hint) {
    const hintY = H - 104;
    ctx.fillStyle = '#2e2e4a';
    ctx.fillRect(64, hintY - 38, W - 128, 64);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 28px sans-serif';
    const hintLines = wrapText(ctx, 'ヒント：' + hint, W - 176).slice(0, 1);
    ctx.fillText(hintLines[0], 88, hintY + 6);
  }

  // 📎 フッター
  ctx.fillStyle = '#8b8ba7';
  ctx.font = '24px sans-serif';
  ctx.fillText('nazoya — 謎解き・暗号メーカー', 64, H - 44);
  return canvas;
}

// 🔢 カードに収まる行数を数える（上限7行を超えるカードを黙って切り捨てないための事前チェック）
function countCardLines(problemText) {
  const canvas = $('card-canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '40px sans-serif';
  return wrapText(ctx, problemText, 1200 - 128).length;
}

// 🃏 カード生成ボタン: 暗号化→行数チェック→描画→PNG ダウンロード
$('btn-card').addEventListener('click', () => {
  if (!inputEl.value) { setStatus('カードにする文章を「元の文章」に入力してください。'); return; }
  const method = methodEl.value;
  const problem = convert(inputEl.value, method, currentShift(), false);
  if (countCardLines(problem) > 7) {
    setStatus('問題文がカードの上限（7行）を超えています。本文を短くしてから作成してください。');
    return;
  }
  const canvas = drawCard(problem, METHOD_NAMES[method], hintEl.value.trim());
  const a = document.createElement('a');
  a.download = 'nazoya-card.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
  setStatus('問題カードをダウンロードしました。');
});

// 🖼️ 初期プレビュー（空のカード枠に案内文）
drawCard('ここに暗号文が表示されます', 'シーザー暗号', '');

// ==========================================
// 🌙 テーマ切り替え（ダーク／ライト）
// ==========================================
// 📌 保存キー "nazoya-theme"。<head> の先行スクリプトが保存値を data-theme に適用済みの場合がある

(function initTheme() {
  var root = document.documentElement;
  if (!root || !root.getAttribute || !root.setAttribute) return;
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  }
  var current = root.getAttribute('data-theme');
  if (current !== 'light' && current !== 'dark') {
    try { current = localStorage.getItem('nazoya-theme'); } catch (e) { current = null; }
  }
  apply(current === 'light' ? 'light' : 'dark');
  var btn = document.getElementById('themeToggle');
  if (btn && btn.addEventListener) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem('nazoya-theme', next); } catch (e) { /* 保存できなくても切り替え自体は有効 */ }
    });
  }
})();
