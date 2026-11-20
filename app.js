'use strict';

/* ===== 共通ユーティリティ ===== */

// 五十音（清音46文字）。あ=01 … ん=46 の順
const GOJUUON = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KATA46 = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

function kataToHira(s) {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/* ===== 1. シーザー暗号 ===== */

const CAESAR_SETS = [
  GOJUUON,
  KATA46,
  'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '0123456789'
];

function caesar(text, shift) {
  return Array.from(text).map((ch) => {
    for (const set of CAESAR_SETS) {
      const i = set.indexOf(ch);
      if (i >= 0) {
        const n = set.length;
        return set[(((i + shift) % n) + n) % n];
      }
    }
    return ch;
  }).join('');
}

/* ===== 2. 文字反転 ===== */

function reverseText(text) {
  return Array.from(text).reverse().join('');
}

/* ===== 3. あ↔数字変換 ===== */

function toNumber(text) {
  const hira = kataToHira(text);
  return Array.from(hira).map((ch) => {
    const i = GOJUUON.indexOf(ch);
    return i >= 0 ? String(i + 1).padStart(2, '0') : ch;
  }).join(' ');
}

function fromNumber(text) {
  return text.trim().split(/\s+/).filter(Boolean).map((tok) => {
    // 数字だけの長い塊は2桁ずつに区切って解釈する
    if (/^\d+$/.test(tok) && tok.length >= 2 && tok.length % 2 === 0) {
      let out = '';
      for (let i = 0; i < tok.length; i += 2) {
        const n = parseInt(tok.slice(i, i + 2), 10);
        out += (n >= 1 && n <= 46) ? GOJUUON[n - 1] : tok.slice(i, i + 2);
      }
      return out;
    }
    return tok;
  }).join('');
}

/* ===== 4. モールス信号（日本語カナ） ===== */
/* 内部表現は '.' と '-'、表示時に '・' と '−' へ変換する */

const MORSE_TABLE = {
  'ア': '--.--', 'イ': '.-', 'ウ': '..-', 'エ': '-.---', 'オ': '.-...',
  'カ': '.-..', 'キ': '-.-..', 'ク': '...-', 'ケ': '-.--', 'コ': '----',
  'サ': '-.-.-', 'シ': '--.-.', 'ス': '---.-', 'セ': '.---.', 'ソ': '---.',
  'タ': '-.', 'チ': '..-.', 'ツ': '.--.', 'テ': '.-.--', 'ト': '..-..',
  'ナ': '.-.', 'ニ': '-.-.', 'ヌ': '....', 'ネ': '--.-', 'ノ': '..--',
  'ハ': '-...', 'ヒ': '--..-', 'フ': '--..', 'ヘ': '.', 'ホ': '-..',
  'マ': '-..-', 'ミ': '..-.-', 'ム': '-', 'メ': '-...-', 'モ': '-..-.',
  'ヤ': '.--', 'ユ': '-..--', 'ヨ': '--',
  'ラ': '...', 'リ': '--.', 'ル': '-.--.', 'レ': '---', 'ロ': '.-.-',
  'ワ': '-.-', 'ヰ': '.-..-', 'ヱ': '.--..', 'ヲ': '.---', 'ン': '.-.-.',
  'ー': '.--.-', '゛': '..', '゜': '..--.'
};
// 符号表は標準の和文モールス（無線局運用規則・別表第1号）に準拠し、各符号は一意
const MORSE_REVERSE = {};
for (const [kana, code] of Object.entries(MORSE_TABLE)) {
  if (!(code in MORSE_REVERSE)) MORSE_REVERSE[code] = kana;
}

const DAKUTEN_MAP = {
  'ガ': 'カ゛', 'ギ': 'キ゛', 'グ': 'ク゛', 'ゲ': 'ケ゛', 'ゴ': 'コ゛',
  'ザ': 'サ゛', 'ジ': 'シ゛', 'ズ': 'ス゛', 'ゼ': 'セ゛', 'ゾ': 'ソ゛',
  'ダ': 'タ゛', 'ヂ': 'チ゛', 'ヅ': 'ツ゛', 'デ': 'テ゛', 'ド': 'ト゛',
  'バ': 'ハ゛', 'ビ': 'ヒ゛', 'ブ': 'フ゛', 'ベ': 'ヘ゛', 'ボ': 'ホ゛',
  'パ': 'ハ゜', 'ピ': 'ヒ゜', 'プ': 'フ゜', 'ペ': 'ヘ゜', 'ポ': 'ホ゜',
  'ヴ': 'ウ゛'
};
const DAKUTEN_REVERSE = {};
for (const [voiced, plain] of Object.entries(DAKUTEN_MAP)) {
  DAKUTEN_REVERSE[plain] = voiced;
}

function morseEncode(text) {
  // ひらがなはカタカナにそろえてから変換する
  const normalized = text.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const tokens = [];
  for (const ch of Array.from(normalized)) {
    if (ch === ' ' || ch === '　') { tokens.push('/'); continue; }
    const expanded = DAKUTEN_MAP[ch] || ch;
    for (const c of Array.from(expanded)) {
      tokens.push(MORSE_TABLE[c] || c);
    }
  }
  return tokens.join(' ').replace(/\./g, '・').replace(/-/g, '−');
}

function morseDecode(text) {
  const normalized = text
    .replace(/[・.･]/g, '.')
    .replace(/[-−―ー－]/g, '-');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  let out = '';
  for (const tok of tokens) {
    if (tok === '/') { out += ' '; continue; }
    // '..' は濁点符号。直前の文字が濁点と組み合わさる場合は濁点として扱う
    if (tok === '..') {
      const combined = DAKUTEN_REVERSE[out.slice(-1) + '゛'];
      if (combined) { out = out.slice(0, -1) + combined; continue; }
      out += '゛';
      continue;
    }
    out += MORSE_REVERSE[tok] || tok;
  }
  // 半濁点（゜）の組み合わせを戻す
  for (const [plain, voiced] of Object.entries(DAKUTEN_REVERSE)) {
    out = out.split(plain).join(voiced);
  }
  return out;
}

/* ===== 変換の実行 ===== */

const METHOD_NAMES = {
  caesar: 'シーザー暗号',
  reverse: '文字反転',
  number: 'あ↔数字変換',
  morse: 'モールス信号'
};

function convert(text, method, shift, decrypt) {
  switch (method) {
    case 'caesar': return caesar(text, decrypt ? -shift : shift);
    case 'reverse': return reverseText(text);
    case 'number': return decrypt ? fromNumber(text) : toNumber(text);
    case 'morse': return decrypt ? morseDecode(text) : morseEncode(text);
    default: return text;
  }
}

/* ===== DOM 連携 ===== */

const $ = (id) => document.getElementById(id);
const inputEl = $('input-text');
const outputEl = $('output-text');
const methodEl = $('method');
const shiftEl = $('shift');
const shiftWrap = $('shift-wrap');
const hintEl = $('hint-text');
const statusEl = $('status');

function setStatus(msg) { statusEl.textContent = msg; }

function currentShift() {
  const v = parseInt(shiftEl.value, 10);
  return Number.isFinite(v) ? v : 3;
}

function updateShiftVisibility() {
  shiftWrap.style.display = methodEl.value === 'caesar' ? '' : 'none';
}
methodEl.addEventListener('change', updateShiftVisibility);
updateShiftVisibility();

$('btn-encrypt').addEventListener('click', () => {
  if (!inputEl.value) { setStatus('元の文章を入力してください。'); return; }
  outputEl.value = convert(inputEl.value, methodEl.value, currentShift(), false);
  setStatus(METHOD_NAMES[methodEl.value] + 'で暗号化しました。');
});

$('btn-decrypt').addEventListener('click', () => {
  if (!inputEl.value) { setStatus('復号したい文章を入力してください。'); return; }
  outputEl.value = convert(inputEl.value, methodEl.value, currentShift(), true);
  setStatus(METHOD_NAMES[methodEl.value] + 'で復号しました。');
});

$('btn-swap').addEventListener('click', () => {
  const tmp = inputEl.value;
  inputEl.value = outputEl.value;
  outputEl.value = tmp;
  setStatus('入力と出力を入れ替えました。');
});

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

/* ===== 問題カード（Canvas） ===== */

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

function drawCard(problemText, methodName, hint) {
  const canvas = $('card-canvas');
  const ctx = canvas.getContext('2d');
  const W = 1200, H = 630;

  ctx.fillStyle = '#232338';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4338ca';
  ctx.fillRect(0, 0, W, 14);
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  ctx.fillStyle = '#a5b4fc';
  ctx.font = '700 30px sans-serif';
  ctx.fillText('なぞとき問題カード', 64, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px sans-serif';
  ctx.fillText('方式：' + methodName, 64, 148);

  ctx.font = '40px sans-serif';
  const lines = wrapText(ctx, problemText, W - 128).slice(0, 7);
  // 7行＋ヒントボックス＋フッターが重ならないよう縦方向を再配分する
  // （問題文: 開始206・行間44で7行目の下端は約474、ヒントボックスは488〜552）
  let y = 206;
  for (const line of lines) {
    ctx.fillText(line, 64, y);
    y += 44;
  }

  if (hint) {
    const hintY = H - 104;
    ctx.fillStyle = '#2e2e4a';
    ctx.fillRect(64, hintY - 38, W - 128, 64);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 28px sans-serif';
    const hintLines = wrapText(ctx, 'ヒント：' + hint, W - 176).slice(0, 1);
    ctx.fillText(hintLines[0], 88, hintY + 6);
  }

  ctx.fillStyle = '#8b8ba7';
  ctx.font = '24px sans-serif';
  ctx.fillText('nazoya — 謎解き・暗号メーカー', 64, H - 44);
  return canvas;
}

// カードに収まる行数（カード側の上限は7行。超過分が無言で切り捨てられないよう事前に数える）
function countCardLines(problemText) {
  const canvas = $('card-canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '40px sans-serif';
  return wrapText(ctx, problemText, 1200 - 128).length;
}

$('btn-card').addEventListener('click', () => {
  if (!inputEl.value) { setStatus('カードにする文章を「元の文章」に入力してください。'); return; }
  const method = methodEl.value;
  // カードに載せるのは暗号文のみ（答えは含めない）
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

// 初期プレビュー（空のカード枠）
drawCard('ここに暗号文が表示されます', 'シーザー暗号', '');

/* ===== テーマ切り替え（ダーク／ライト） ===== */

(function initTheme() {
  var root = document.documentElement;
  if (!root || !root.getAttribute || !root.setAttribute) return;
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  }
  var current = root.getAttribute("data-theme");
  if (current !== "light" && current !== "dark") {
    try { current = localStorage.getItem("nazoya-theme"); } catch (e) { current = null; }
  }
  apply(current === "light" ? "light" : "dark");
  var btn = document.getElementById("themeToggle");
  if (btn && btn.addEventListener) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem("nazoya-theme", next); } catch (e) { /* 保存できなくても切り替え自体は有効 */ }
    });
  }
})();
