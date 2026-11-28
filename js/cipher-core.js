// ==========================================
// 🔐 nazoya — 変換ロジック中核（DOM 非依存）
// 4方式の暗号化／復号だけを集めたモジュール。
// ブラウザでは app.js の前に読み込まれ、Node ではテストから require される。
// ==========================================
"use strict";

const NazoyaCore = (() => {
  // ----------------------------------------
  // 🔤 五十音テーブル
  // ----------------------------------------
  // 📌 清音46文字。あ=01 … ん=46 の並び（あ↔数字変換とシーザー暗号で共用）
  const GOJUUON = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
  // 📌 GOJUUON と同じ並びのカタカナ
  const KATA46 = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

  // 🔤 カタカナ（ァ〜ヶ）をひらがなへ変換する（コードポイントを -0x60）
  function kataToHira(s) {
    return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  // 🔤 ひらがな（ぁ〜ゖ）をカタカナへ変換する（コードポイントを +0x60）
  function hiraToKata(s) {
    return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  }

  // ----------------------------------------
  // 🔐 シーザー暗号
  // ----------------------------------------
  // 📌 ずらす対象の文字集合。集合に無い文字はそのまま通す
  const CAESAR_SETS = [
    GOJUUON,
    KATA46,
    "abcdefghijklmnopqrstuvwxyz",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789"
  ];

  // 🔐 各文字を所属する集合の中で shift だけずらす（負数・集合の長さ以上も正規化する）
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
    }).join("");
  }

  // ----------------------------------------
  // 🔄 文字反転
  // ----------------------------------------
  // 🔄 コードポイント単位で逆順にする（サロゲートペアを壊さない）。暗号化と復号は同じ操作
  function reverseText(text) {
    return Array.from(text).reverse().join("");
  }

  // ----------------------------------------
  // 🔢 あ↔数字変換
  // ----------------------------------------
  // 🔢 ひらがな／カタカナを五十音順の2桁番号（あ=01 … ん=46）へ変換する。
  //    五十音に無い文字はそのまま1トークンとして残し、トークンは空白でつなぐ
  function toNumber(text) {
    const hira = kataToHira(text);
    return Array.from(hira).map((ch) => {
      const i = GOJUUON.indexOf(ch);
      return i >= 0 ? String(i + 1).padStart(2, "0") : ch;
    }).join(" ");
  }

  // 🔢 数字をひらがなへ戻す。空白区切りのトークンごとに解釈し、結果は連結する。
  //    数字だけの偶数長トークンは2桁ずつに割って読み、範囲外（01〜46以外）の組は数字のまま残す。
  //    それ以外のトークン（奇数長・数字以外を含む）はそのまま返す
  function fromNumber(text) {
    return text.trim().split(/\s+/).filter(Boolean).map((tok) => {
      if (/^\d+$/.test(tok) && tok.length >= 2 && tok.length % 2 === 0) {
        let out = "";
        for (let i = 0; i < tok.length; i += 2) {
          const pair = tok.slice(i, i + 2);
          const n = parseInt(pair, 10);
          out += (n >= 1 && n <= 46) ? GOJUUON[n - 1] : pair;
        }
        return out;
      }
      return tok;
    }).join("");
  }

  // ----------------------------------------
  // 📻 モールス信号（日本語カナ）
  // ----------------------------------------
  // 📌 内部表現は "." と "-"、表示時に "・" と "−" へ置き換える
  // 📌 符号表は標準の和文モールス（無線局運用規則・別表第1号）に準拠し、各符号は一意
  const MORSE_TABLE = {
    "ア": "--.--", "イ": ".-", "ウ": "..-", "エ": "-.---", "オ": ".-...",
    "カ": ".-..", "キ": "-.-..", "ク": "...-", "ケ": "-.--", "コ": "----",
    "サ": "-.-.-", "シ": "--.-.", "ス": "---.-", "セ": ".---.", "ソ": "---.",
    "タ": "-.", "チ": "..-.", "ツ": ".--.", "テ": ".-.--", "ト": "..-..",
    "ナ": ".-.", "ニ": "-.-.", "ヌ": "....", "ネ": "--.-", "ノ": "..--",
    "ハ": "-...", "ヒ": "--..-", "フ": "--..", "ヘ": ".", "ホ": "-..",
    "マ": "-..-", "ミ": "..-.-", "ム": "-", "メ": "-...-", "モ": "-..-.",
    "ヤ": ".--", "ユ": "-..--", "ヨ": "--",
    "ラ": "...", "リ": "--.", "ル": "-.--.", "レ": "---", "ロ": ".-.-",
    "ワ": "-.-", "ヰ": ".-..-", "ヱ": ".--..", "ヲ": ".---", "ン": ".-.-.",
    "ー": ".--.-", "゛": "..", "゜": "..--."
  };
  // 📻 符号→カナの逆引き（重複符号があれば先勝ち。現行表では重複なし）
  const MORSE_REVERSE = {};
  for (const [kana, code] of Object.entries(MORSE_TABLE)) {
    if (!(code in MORSE_REVERSE)) MORSE_REVERSE[code] = kana;
  }

  // 📌 濁音・半濁音 → 清音＋濁点（゛）／半濁点（゜）の展開表。゛は U+309B、゜は U+309C
  const DAKUTEN_MAP = {
    "ガ": "カ゛", "ギ": "キ゛", "グ": "ク゛", "ゲ": "ケ゛", "ゴ": "コ゛",
    "ザ": "サ゛", "ジ": "シ゛", "ズ": "ス゛", "ゼ": "セ゛", "ゾ": "ソ゛",
    "ダ": "タ゛", "ヂ": "チ゛", "ヅ": "ツ゛", "デ": "テ゛", "ド": "ト゛",
    "バ": "ハ゛", "ビ": "ヒ゛", "ブ": "フ゛", "ベ": "ヘ゛", "ボ": "ホ゛",
    "パ": "ハ゜", "ピ": "ヒ゜", "プ": "フ゜", "ペ": "ヘ゜", "ポ": "ホ゜",
    "ヴ": "ウ゛"
  };
  // 📌 逆引き（清音＋点 → 濁音）。復号の後処理はこの挿入順に置換するため、順序を保つ
  const DAKUTEN_REVERSE = {};
  for (const [voiced, plain] of Object.entries(DAKUTEN_MAP)) {
    DAKUTEN_REVERSE[plain] = voiced;
  }

  // 📻 カナをモールス信号（表示形）へ変換する。
  //    ひらがなはカタカナにそろえ、空白（半角・全角）は "/" で区切る。
  //    濁音は清音＋点に展開し、表に無い文字はそのまま1トークンとして残す
  function morseEncode(text) {
    const normalized = hiraToKata(text);
    const tokens = [];
    for (const ch of Array.from(normalized)) {
      if (ch === " " || ch === "　") { tokens.push("/"); continue; }
      const expanded = DAKUTEN_MAP[ch] || ch;
      for (const c of Array.from(expanded)) {
        tokens.push(MORSE_TABLE[c] || c);
      }
    }
    return tokens.join(" ").replace(/\./g, "・").replace(/-/g, "−");
  }

  // 📻 モールス信号をカナへ戻す。
  //    表示形（・／−）・ASCII（.／-）・半角（･）・各種ダッシュを受け付け、空白でトークンに割る。
  //    ".." は濁点符号として直前の文字と合成を試み、できなければ "゛" として残す。
  //    半濁点は符号 "..--." → "゜" を経て、最後に一括で清音＋点を濁音へ戻す
  function morseDecode(text) {
    const normalized = text
      .replace(/[・.･]/g, ".")
      .replace(/[-−―ー－]/g, "-");
    const tokens = normalized.trim().split(/\s+/).filter(Boolean);
    let out = "";
    for (const tok of tokens) {
      if (tok === "/") { out += " "; continue; }
      if (tok === "..") {
        const combined = DAKUTEN_REVERSE[out.slice(-1) + "゛"];
        if (combined) { out = out.slice(0, -1) + combined; continue; }
        out += "゛";
        continue;
      }
      out += MORSE_REVERSE[tok] || tok;
    }
    for (const [plain, voiced] of Object.entries(DAKUTEN_REVERSE)) {
      out = out.split(plain).join(voiced);
    }
    return out;
  }

  // ----------------------------------------
  // ⚙️ 変換の実行
  // ----------------------------------------
  // 📌 方式の表示名（UI と問題カードで共用）
  const METHOD_NAMES = {
    caesar: "シーザー暗号",
    reverse: "文字反転",
    number: "あ↔数字変換",
    morse: "モールス信号"
  };

  // ⚙️ 方式と向きに応じて変換する。シーザーの復号は幅を反転、反転は双方向で同じ操作
  function convert(text, method, shift, decrypt) {
    switch (method) {
      case "caesar": return caesar(text, decrypt ? -shift : shift);
      case "reverse": return reverseText(text);
      case "number": return decrypt ? fromNumber(text) : toNumber(text);
      case "morse": return decrypt ? morseDecode(text) : morseEncode(text);
      default: return text;
    }
  }

  return {
    GOJUUON,
    KATA46,
    kataToHira,
    hiraToKata,
    CAESAR_SETS,
    caesar,
    reverseText,
    toNumber,
    fromNumber,
    MORSE_TABLE,
    MORSE_REVERSE,
    DAKUTEN_MAP,
    DAKUTEN_REVERSE,
    morseEncode,
    morseDecode,
    METHOD_NAMES,
    convert
  };
})();

// 🌐 読み込み先に応じて公開する（ブラウザ: グローバル / Node: module.exports）
if (typeof module !== "undefined" && module.exports) {
  module.exports = NazoyaCore;
}
if (typeof window !== "undefined") {
  window.NazoyaCore = NazoyaCore;
}
