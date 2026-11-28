"use strict";
// ==========================================
// 🧪 nazoya — 変換ロジック中核の単体テスト（node:test、依存なし）
// 実行: npm test
// ==========================================
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../js/cipher-core.js");

// 📌 表示形モールスの文字コードを固定する（テスト内リテラルの取り違え防止）
const DOT = "・";
const DASH = "−";
test("表示形モールスの前提: ・ は U+30FB、− は U+2212", () => {
  assert.equal(DOT.charCodeAt(0), 0x30fb);
  assert.equal(DASH.charCodeAt(0), 0x2212);
});

// 表示形（・／−）を組み立てるヘルパー
const disp = (ascii) => ascii.replace(/\./g, DOT).replace(/-/g, DASH);

// ----------------------------------------
// 🔤 五十音テーブル
// ----------------------------------------
test("五十音テーブル: 清音46文字、あ=先頭・ん=末尾、重複なし", () => {
  assert.equal(Core.GOJUUON.length, 46);
  assert.equal(Core.KATA46.length, 46);
  assert.equal(new Set(Core.GOJUUON).size, 46);
  assert.equal(new Set(Core.KATA46).size, 46);
  assert.equal(Core.GOJUUON[0], "あ");
  assert.equal(Core.GOJUUON[45], "ん");
  assert.equal(Core.KATA46[0], "ア");
  assert.equal(Core.KATA46[45], "ン");
});

test("kataToHira / hiraToKata: カナ相互変換", () => {
  assert.equal(Core.kataToHira("アイウエオ"), "あいうえお");
  assert.equal(Core.kataToHira("ヶ"), "ゖ"); // ヶ(U+30F6) - 0x60 = ゖ(U+3096、小書きのけ)
  assert.equal(Core.kataToHira("ヰ"), "ゐ");
  assert.equal(Core.kataToHira("abc漢"), "abc漢");
  assert.equal(Core.hiraToKata("あいうえお"), "アイウエオ");
  assert.equal(Core.hiraToKata("ゎ"), "ヮ");
});

// ----------------------------------------
// 🔐 シーザー暗号
// ----------------------------------------
test("シーザー暗号: 既知ベクトル（かな・カナ・英数字）", () => {
  assert.equal(Core.caesar("あいうえお", 3), "えおかきく");
  assert.equal(Core.caesar("アイウエオ", 3), "エオカキク");
  assert.equal(Core.caesar("abcXYZ019", 3), "defABC342");
});

test("シーザー暗号: 集合の末尾から先頭へ回る", () => {
  assert.equal(Core.caesar("ん", 1), "あ");
  assert.equal(Core.caesar("ン", 1), "ア");
  assert.equal(Core.caesar("z", 1), "a");
  assert.equal(Core.caesar("Z", 1), "A");
  assert.equal(Core.caesar("9", 1), "0");
  assert.equal(Core.caesar("あ", -1), "ん");
});

test("シーザー暗号: 幅0と集合サイズの幅は恒等、集合外の文字は不変", () => {
  const s = "あいうえお漢字、！？";
  assert.equal(Core.caesar(s, 0), s);
  assert.equal(Core.caesar("あいうえお", 46), "あいうえお");
  assert.equal(Core.caesar("abc", 26), "abc");
  assert.equal(Core.caesar("漢字、！？", 5), "漢字、！？");
});

test("シーザー暗号: 往復（暗号化→復号）で元に戻る", () => {
  const samples = ["あいうえおかきくけこ", "アイウエオ", "Hello, World! 123", "んんん", "漢字混じりabc"];
  for (const s of samples) {
    for (const shift of [-100, -46, -3, -1, 1, 3, 45, 46, 100]) {
      assert.equal(Core.caesar(Core.caesar(s, shift), -shift), s);
    }
  }
});

// ----------------------------------------
// 🔄 文字反転
// ----------------------------------------
test("文字反転: 逆順化と往復、サロゲートペアを壊さない", () => {
  assert.equal(Core.reverseText("あいう"), "ういあ");
  assert.equal(Core.reverseText("a😀b"), "b😀a");
  assert.equal(Core.reverseText(""), "");
  const s = "なぞとき問題カード123";
  assert.equal(Core.reverseText(Core.reverseText(s)), s);
});

// ----------------------------------------
// 🔢 あ↔数字変換
// ----------------------------------------
test("あ↔数字: 既知ベクトル（ひらがな・カタカナ）", () => {
  assert.equal(Core.toNumber("あ"), "01");
  assert.equal(Core.toNumber("ん"), "46");
  assert.equal(Core.toNumber("あいうえお"), "01 02 03 04 05");
  assert.equal(Core.toNumber("アイウ"), "01 02 03");
  assert.equal(Core.toNumber(""), "");
});

test("あ↔数字: 五十音に無い文字はそのままトークンになる", () => {
  assert.equal(Core.toNumber("あAい"), "01 A 02");
  assert.equal(Core.toNumber("漢"), "漢");
});

test("数字→あ: 空白区切りと数字の塊（2桁ずつ）の両対応", () => {
  assert.equal(Core.fromNumber("01 02 03"), "あいう");
  assert.equal(Core.fromNumber("010203"), "あいう");
  assert.equal(Core.fromNumber("46"), "ん");
  assert.equal(Core.fromNumber("  01   02 "), "あい");
  assert.equal(Core.fromNumber(""), "");
});

test("数字→あ: 範囲外・奇数長・非数字トークンはそのまま残る", () => {
  assert.equal(Core.fromNumber("47"), "47");
  assert.equal(Core.fromNumber("00"), "00");
  assert.equal(Core.fromNumber("99"), "99");
  assert.equal(Core.fromNumber("123"), "123");
  assert.equal(Core.fromNumber("1"), "1");
  assert.equal(Core.fromNumber("あ"), "あ");
  // 塊の中では組ごとに判定する（01は変換、47は残す）
  assert.equal(Core.fromNumber("0147"), "あ47");
});

test("あ↔数字: 往復で元に戻る（五十音46文字すべて）", () => {
  assert.equal(Core.fromNumber(Core.toNumber(Core.GOJUUON)), Core.GOJUUON);
  assert.equal(Core.fromNumber(Core.toNumber(Core.KATA46)), Core.GOJUUON);
  assert.equal(Core.fromNumber(Core.toNumber("なぞとき")), "なぞとき");
});

// ----------------------------------------
// 📻 モールス信号
// ----------------------------------------
test("モールス符号表: 51エントリ・符号は一意・標準表の要点", () => {
  const entries = Object.entries(Core.MORSE_TABLE);
  assert.equal(entries.length, 51);
  assert.equal(new Set(Object.values(Core.MORSE_TABLE)).size, 51);
  // 既知ベクトル
  assert.equal(Core.MORSE_TABLE["ヘ"], ".");
  assert.equal(Core.MORSE_TABLE["ム"], "-");
  assert.equal(Core.MORSE_TABLE["ヨ"], "--");
  assert.equal(Core.MORSE_TABLE["ヲ"], ".---");
  assert.equal(Core.MORSE_TABLE["ン"], ".-.-.");
  assert.equal(Core.MORSE_TABLE["ー"], ".--.-");
  assert.equal(Core.MORSE_TABLE["゛"], "..");
  assert.equal(Core.MORSE_TABLE["゜"], "..--.");
  // 2026-11 に標準表へ修正された7件（タ・ユ・ヨ・ル・ロ・ヲ・濁点）
  assert.equal(Core.MORSE_TABLE["タ"], "-.");
  assert.equal(Core.MORSE_TABLE["ユ"], "-..--");
  assert.equal(Core.MORSE_TABLE["ル"], "-.--.");
  assert.equal(Core.MORSE_TABLE["ロ"], ".-.-");
});

test("モールス符号化: 既知ベクトルと表示形変換", () => {
  assert.equal(Core.morseEncode("ヘ"), DOT);
  assert.equal(Core.morseEncode("アイウ"), disp("--.-- .- ..-"));
  assert.equal(Core.morseEncode("あ"), disp("--.--")); // ひらがなはカタカナ扱い
  assert.equal(Core.morseEncode(""), "");
});

test("モールス符号化: 濁音・半濁音は清音＋点へ展開する", () => {
  assert.equal(Core.morseEncode("ガ"), disp(".-.. .."));
  assert.equal(Core.morseEncode("パ"), disp("-... ..--."));
  assert.equal(Core.morseEncode("ヴ"), disp("..- .."));
  assert.equal(Core.morseEncode("が"), disp(".-.. ..")); // ひらがな濁音も同じ
});

test("モールス符号化: 空白は / 区切り、表に無い文字はそのまま残る", () => {
  assert.equal(Core.morseEncode("ア イ"), disp("--.--") + " / " + disp(".-"));
  assert.equal(Core.morseEncode("ア　イ"), disp("--.--") + " / " + disp(".-")); // 全角空白も同じ
  assert.equal(Core.morseEncode("A"), "A");
  assert.equal(Core.morseEncode("ッ"), "ッ"); // 小書きカナは表に無い
});

test("モールス復号: ASCII・表示形・半角など表記ゆれを受け付ける", () => {
  assert.equal(Core.morseDecode(".-"), "イ");
  assert.equal(Core.morseDecode(disp(".-")), "イ");
  assert.equal(Core.morseDecode("･－"), "イ"); // 半角･と全角－
  assert.equal(Core.morseDecode("--.-- .- ..-"), "アイウ");
  assert.equal(Core.morseDecode(""), "");
});

test("モールス復号: 濁点の合成と半濁点の後処理", () => {
  assert.equal(Core.morseDecode(disp(".-.. ..")), "ガ"); // カ + ゛
  assert.equal(Core.morseDecode(disp("-... ..--.")), "パ"); // ハ + ゜
  assert.equal(Core.morseDecode(disp("..- ..")), "ヴ"); // ウ + ゛
  assert.equal(Core.morseDecode(disp("..")), "゛"); // 合成先が無い単独の濁点
});

test("モールス復号: / は空白、未知トークンはそのまま、長音記号の扱い（既知の癖）", () => {
  assert.equal(Core.morseDecode("--.-- / .-"), "ア イ");
  assert.equal(Core.morseDecode("...---..."), "...---...");
  // 復号入力の「ー」はダッシュ類として正規化されるため、符号 ".--.-" でしか長音に戻らない
  assert.equal(Core.morseDecode("ー"), "ム");
  assert.equal(Core.morseDecode(".--.-"), "ー");
});

test("モールス: 往復で元に戻る", () => {
  const samples = [
    "アイウエオ",
    "ガギグゲゴ",
    "ザジズゼゾダヂヅデド",
    "バビブベボ",
    "パピプペポ",
    "ヴ",
    "ヰヱヲン",
    "ー",
    "ア イ ウ",
    "ナゾトキモールス"
  ];
  for (const s of samples) {
    assert.equal(Core.morseDecode(Core.morseEncode(s)), s, "roundtrip: " + s);
  }
  // ひらがな入力はカタカナとして往復する
  assert.equal(Core.morseDecode(Core.morseEncode("がんばる")), "ガンバル");
});

// ----------------------------------------
// ⚙️ convert ディスパッチャ
// ----------------------------------------
test("convert: 方式と向きの振り分け、未知の方式は素通し", () => {
  assert.equal(Core.convert("あ", "caesar", 3, false), "え");
  assert.equal(Core.convert("え", "caesar", 3, true), "あ");
  assert.equal(Core.convert("あいう", "reverse", 0, false), "ういあ");
  assert.equal(Core.convert("あいう", "reverse", 0, true), "ういあ");
  assert.equal(Core.convert("あ", "number", 0, false), "01");
  assert.equal(Core.convert("01", "number", 0, true), "あ");
  assert.equal(Core.convert("ヘ", "morse", 0, false), DOT);
  assert.equal(Core.convert(DOT, "morse", 0, true), "ヘ");
  assert.equal(Core.convert("そのまま", "unknown", 3, false), "そのまま");
  assert.deepEqual(Core.METHOD_NAMES, {
    caesar: "シーザー暗号",
    reverse: "文字反転",
    number: "あ↔数字変換",
    morse: "モールス信号"
  });
});
