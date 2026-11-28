using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace Nazoya
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
    }

    // 🔐 Web 版（nazoya）js/cipher-core.js の変換ロジックを C# で再現する。
    internal static class Cipher
    {
        // 🔤 五十音（清音46文字）。あ=01 … ん=46 の順
        public const string Gojuuon = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
        public const string Kata46 = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

        // 🔤 文字列をコードポイント（ルーン）の列に分ける
        private static List<string> CodePoints(string s)
        {
            var list = new List<string>();
            foreach (var rune in s.EnumerateRunes()) list.Add(rune.ToString());
            return list;
        }

        // 🔤 カタカナをひらがなへ変換する（ァ〜ヶ を -0x60）
        private static string KataToHira(string s)
        {
            var sb = new StringBuilder();
            foreach (char c in s)
            {
                sb.Append(c >= 'ァ' && c <= 'ヶ' ? (char)(c - 0x60) : c);
            }
            return sb.ToString();
        }

        /* ===== 🔐 シーザー暗号 ===== */

        private static readonly string[] CaesarSets =
        {
            Gojuuon,
            Kata46,
            "abcdefghijklmnopqrstuvwxyz",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "0123456789"
        };

        // 🔐 各文字を所属する集合の中で shift だけずらす（集合に無い文字はそのまま）
        public static string Caesar(string text, int shift)
        {
            var sb = new StringBuilder();
            foreach (var ch in CodePoints(text))
            {
                string replaced = ch;
                foreach (var set in CaesarSets)
                {
                    int i = set.IndexOf(ch, StringComparison.Ordinal);
                    if (i >= 0)
                    {
                        int n = set.Length;
                        replaced = set[(((i + shift) % n) + n) % n].ToString();
                        break;
                    }
                }
                sb.Append(replaced);
            }
            return sb.ToString();
        }

        /* ===== 🔄 文字反転 ===== */

        // 🔄 コードポイント単位で逆順にする。暗号化と復号は同じ操作
        public static string ReverseText(string text)
        {
            var cps = CodePoints(text);
            cps.Reverse();
            return string.Concat(cps);
        }

        /* ===== 🔢 あ↔数字変換 ===== */

        // 🔢 ひらがな／カタカナを五十音順の2桁番号（あ=01 … ん=46）へ変換する
        public static string ToNumber(string text)
        {
            string hira = KataToHira(text);
            var parts = new List<string>();
            foreach (var ch in CodePoints(hira))
            {
                int i = ch.Length == 1 ? Gojuuon.IndexOf(ch[0]) : -1;
                parts.Add(i >= 0 ? (i + 1).ToString("D2") : ch);
            }
            return string.Join(" ", parts);
        }

        // 🔢 数字をひらがなへ戻す。数字だけの偶数長トークンは2桁ずつ読み、範囲外は数字のまま残す
        public static string FromNumber(string text)
        {
            var tokens = Regex.Split(text.Trim(), @"\s+");
            var sb = new StringBuilder();
            foreach (var tok in tokens)
            {
                if (tok.Length == 0) continue;
                bool allDigits = true;
                foreach (char c in tok) if (c < '0' || c > '9') { allDigits = false; break; }
                if (allDigits && tok.Length >= 2 && tok.Length % 2 == 0)
                {
                    for (int i = 0; i < tok.Length; i += 2)
                    {
                        int n = int.Parse(tok.Substring(i, 2));
                        sb.Append(n >= 1 && n <= 46 ? Gojuuon[n - 1].ToString() : tok.Substring(i, 2));
                    }
                }
                else
                {
                    sb.Append(tok);
                }
            }
            return sb.ToString();
        }

        /* ===== 📻 モールス信号（日本語カナ） ===== */
        /* 内部表現は '.' と '-'、表示時に '・' と '−' へ変換する。
           符号表は標準の和文モールス（無線局運用規則・別表第1号）に準拠し、各符号は一意 */

        private static readonly (string Kana, string Code)[] MorseTable =
        {
            ("ア", "--.--"), ("イ", ".-"), ("ウ", "..-"), ("エ", "-.---"), ("オ", ".-..."),
            ("カ", ".-.."), ("キ", "-.-.."), ("ク", "...-"), ("ケ", "-.--"), ("コ", "----"),
            ("サ", "-.-.-"), ("シ", "--.-."), ("ス", "---.-"), ("セ", ".---."), ("ソ", "---."),
            ("タ", "-."), ("チ", "..-."), ("ツ", ".--."), ("テ", ".-.--"), ("ト", "..-.."),
            ("ナ", ".-."), ("ニ", "-.-."), ("ヌ", "...."), ("ネ", "--.-"), ("ノ", "..--"),
            ("ハ", "-..."), ("ヒ", "--..-"), ("フ", "--.."), ("ヘ", "."), ("ホ", "-.."),
            ("マ", "-..-"), ("ミ", "..-.-"), ("ム", "-"), ("メ", "-...-"), ("モ", "-..-."),
            ("ヤ", ".--"), ("ユ", "-..--"), ("ヨ", "--"),
            ("ラ", "..."), ("リ", "--."), ("ル", "-.--."), ("レ", "---"), ("ロ", ".-.-"),
            ("ワ", "-.-"), ("ヰ", ".-..-"), ("ヱ", ".--.."), ("ヲ", ".---"), ("ン", ".-.-."),
            ("ー", ".--.-"), ("゛", ".."), ("゜", "..--.")
        };

        private static readonly Dictionary<string, string> MorseMap = new Dictionary<string, string>();
        private static readonly Dictionary<string, string> MorseReverse = new Dictionary<string, string>();

        // 📌 濁音・半濁音 → 清音＋濁点（゛=U+309B）／半濁点（゜=U+309C）の展開表
        private static readonly (string Voiced, string Plain)[] DakutenMap =
        {
            ("ガ", "カ゛"), ("ギ", "キ゛"), ("グ", "ク゛"), ("ゲ", "ケ゛"), ("ゴ", "コ゛"),
            ("ザ", "サ゛"), ("ジ", "シ゛"), ("ズ", "ス゛"), ("ゼ", "セ゛"), ("ゾ", "ソ゛"),
            ("ダ", "タ゛"), ("ヂ", "チ゛"), ("ヅ", "ツ゛"), ("デ", "テ゛"), ("ド", "ト゛"),
            ("バ", "ハ゛"), ("ビ", "ヒ゛"), ("ブ", "フ゛"), ("ベ", "ヘ゛"), ("ボ", "ホ゛"),
            ("パ", "ハ゜"), ("ピ", "ヒ゜"), ("プ", "フ゜"), ("ペ", "ヘ゜"), ("ポ", "ホ゜"),
            ("ヴ", "ウ゛")
        };

        private static readonly Dictionary<string, string> DakutenExpand = new Dictionary<string, string>();
        private static readonly Dictionary<string, string> DakutenReverse = new Dictionary<string, string>();
        private static readonly List<(string Plain, string Voiced)> DakutenReverseOrdered = new List<(string, string)>();

        static Cipher()
        {
            foreach (var (kana, code) in MorseTable)
            {
                MorseMap[kana] = code;
                if (!MorseReverse.ContainsKey(code)) MorseReverse[code] = kana;
            }
            foreach (var (voiced, plain) in DakutenMap)
            {
                DakutenExpand[voiced] = plain;
                DakutenReverse[plain] = voiced;
                DakutenReverseOrdered.Add((plain, voiced));
            }
        }

        // 📻 カナをモールス信号（表示形）へ変換する。ひらがなはカタカナにそろえ、空白は "/" で区切る
        public static string MorseEncode(string text)
        {
            var normalized = new StringBuilder();
            foreach (char c in text)
            {
                // 🔤 ひらがな（ぁ〜ゖ = U+3041〜U+3096）を +0x60 してカタカナへ
                normalized.Append(c >= 'ぁ' && c <= 'ゖ' ? (char)(c + 0x60) : c);
            }
            var tokens = new List<string>();
            foreach (char ch in normalized.ToString())
            {
                if (ch == ' ' || ch == '　') { tokens.Add("/"); continue; }
                string expanded = DakutenExpand.TryGetValue(ch.ToString(), out var ex) ? ex : ch.ToString();
                foreach (char c in expanded)
                {
                    tokens.Add(MorseMap.TryGetValue(c.ToString(), out var code) ? code : c.ToString());
                }
            }
            return string.Join(" ", tokens).Replace(".", "・").Replace("-", "−");
        }

        // 📻 モールス信号をカナへ戻す。".." は濁点符号として直前の文字との合成を試みる
        public static string MorseDecode(string text)
        {
            string normalized = text
                .Replace('・', '.').Replace('･', '.')
                .Replace('−', '-').Replace('―', '-').Replace('ー', '-').Replace('－', '-');
            var tokens = Regex.Split(normalized.Trim(), @"\s+");
            var sb = new StringBuilder();
            foreach (var tok in tokens)
            {
                if (tok.Length == 0) continue;
                if (tok == "/") { sb.Append(' '); continue; }
                if (tok == "..")
                {
                    if (sb.Length > 0 && DakutenReverse.TryGetValue(sb[sb.Length - 1] + "゛", out var combined))
                    {
                        sb[sb.Length - 1] = combined[0];
                        continue;
                    }
                    sb.Append('゛');
                    continue;
                }
                sb.Append(MorseReverse.TryGetValue(tok, out var kana) ? kana : tok);
            }
            // 🔤 半濁点（゜）の組み合わせを戻す
            string outStr = sb.ToString();
            foreach (var (plain, voiced) in DakutenReverseOrdered)
            {
                outStr = outStr.Replace(plain, voiced);
            }
            return outStr;
        }

        /* ===== ⚙️ 変換の実行 ===== */

        // ⚙️ 方式と向きに応じて変換する
        public static string Convert(string text, string method, int shift, bool decrypt)
        {
            switch (method)
            {
                case "caesar": return Caesar(text, decrypt ? -shift : shift);
                case "reverse": return ReverseText(text);
                case "number": return decrypt ? FromNumber(text) : ToNumber(text);
                case "morse": return decrypt ? MorseDecode(text) : MorseEncode(text);
                default: return text;
            }
        }
    }

    internal sealed class MainForm : Form
    {
        // 🎨 配色（Web 版のダークテーマに寄せた固定色）
        private static readonly Color Bg = Color.FromArgb(10, 15, 28);
        private static readonly Color Surface = Color.FromArgb(17, 26, 44);
        private static readonly Color Surface2 = Color.FromArgb(24, 38, 66);
        private static readonly Color TextColor = Color.FromArgb(236, 241, 248);
        private static readonly Color Muted = Color.FromArgb(157, 177, 199);
        private static readonly Color Accent = Color.FromArgb(106, 141, 255);

        private static readonly string[] MethodIds = { "caesar", "reverse", "number", "morse" };
        private static readonly string[] MethodNames = { "シーザー暗号", "文字反転", "あ↔数字変換", "モールス信号" };

        private readonly TextBox inputBox;
        private readonly TextBox outputBox;
        private readonly ComboBox methodBox;
        private readonly Label shiftLabel;
        private readonly NumericUpDown shiftBox;
        private readonly TextBox hintBox;
        private readonly Label statusLabel;

        public MainForm()
        {
            Text = "nazoya for Windows｜謎解き・暗号メーカー";
            ClientSize = new Size(560, 660);
            MinimumSize = new Size(576, 699);
            BackColor = Bg;
            ForeColor = TextColor;
            Font = new Font("Yu Gothic UI", 10F);

            var title = new Label
            {
                Text = "nazoya｜謎解き・暗号メーカー",
                Font = new Font("Yu Gothic UI", 15F, FontStyle.Bold),
                ForeColor = TextColor,
                Location = new Point(20, 12),
                AutoSize = true
            };
            Controls.Add(title);

            Controls.Add(MakeLabel("元の文章", 20, 52));
            inputBox = new TextBox
            {
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                Location = new Point(20, 76),
                Size = new Size(520, 78),
                BackColor = Surface2,
                ForeColor = TextColor,
                BorderStyle = BorderStyle.FixedSingle
            };
            Controls.Add(inputBox);

            Controls.Add(MakeLabel("暗号の方式", 20, 164));
            methodBox = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Location = new Point(20, 188),
                Width = 300,
                BackColor = Surface2,
                ForeColor = TextColor
            };
            methodBox.Items.AddRange(new object[]
            {
                "シーザー暗号（文字をずらす）",
                "文字反転（逆さ読み）",
                "あ↔数字変換（五十音順番号）",
                "モールス信号（日本語カナ）"
            });
            methodBox.SelectedIndex = 0;
            methodBox.SelectedIndexChanged += (s, e) => UpdateShiftVisibility();
            Controls.Add(methodBox);

            shiftLabel = MakeLabel("ずらし幅", 336, 164);
            Controls.Add(shiftLabel);
            shiftBox = new NumericUpDown
            {
                Minimum = -1000,
                Maximum = 1000,
                Value = 3,
                Location = new Point(336, 188),
                Width = 90,
                BackColor = Surface2,
                ForeColor = TextColor
            };
            Controls.Add(shiftBox);

            var encryptBtn = MakeButton("暗号化する", 20, 226, 160, true);
            encryptBtn.Click += (s, e) => Run(false);
            Controls.Add(encryptBtn);
            var decryptBtn = MakeButton("復号する", 192, 226, 160, false);
            decryptBtn.Click += (s, e) => Run(true);
            Controls.Add(decryptBtn);
            var swapBtn = MakeButton("入力と出力を入れ替え", 364, 226, 176, false);
            swapBtn.Click += (s, e) =>
            {
                (inputBox.Text, outputBox.Text) = (outputBox.Text, inputBox.Text);
                SetStatus("入力と出力を入れ替えました。");
            };
            Controls.Add(swapBtn);

            Controls.Add(MakeLabel("結果", 20, 272));
            outputBox = new TextBox
            {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Location = new Point(20, 296),
                Size = new Size(520, 78),
                BackColor = Surface,
                ForeColor = TextColor,
                BorderStyle = BorderStyle.FixedSingle
            };
            Controls.Add(outputBox);

            var copyBtn = MakeButton("結果をコピー", 20, 384, 160, false);
            copyBtn.Click += (s, e) =>
            {
                if (outputBox.Text.Length == 0) { SetStatus("コピーする結果がありません。"); return; }
                Clipboard.SetText(outputBox.Text);
                SetStatus("結果をコピーしました。");
            };
            Controls.Add(copyBtn);

            statusLabel = new Label
            {
                Text = "",
                ForeColor = Muted,
                Location = new Point(192, 392),
                AutoSize = true
            };
            Controls.Add(statusLabel);

            Controls.Add(MakeLabel("問題カード（ヒント・任意）", 20, 436));
            hintBox = new TextBox
            {
                Location = new Point(20, 460),
                Width = 520,
                BackColor = Surface2,
                ForeColor = TextColor,
                BorderStyle = BorderStyle.FixedSingle
            };
            Controls.Add(hintBox);

            var cardBtn = MakeButton("問題カードを画像で保存", 20, 496, 220, true);
            cardBtn.Click += (s, e) => SaveCard();
            Controls.Add(cardBtn);

            var note = new Label
            {
                Text = "カードには暗号文だけが載ります（答えは含まれません）。",
                ForeColor = Muted,
                Location = new Point(20, 540),
                AutoSize = true
            };
            Controls.Add(note);

            UpdateShiftVisibility();
        }

        private Label MakeLabel(string text, int x, int y)
        {
            return new Label { Text = text, ForeColor = Muted, Location = new Point(x, y), AutoSize = true };
        }

        private Button MakeButton(string text, int x, int y, int w, bool primary)
        {
            var btn = new Button
            {
                Text = text,
                BackColor = primary ? Accent : Surface2,
                ForeColor = primary ? Color.White : TextColor,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(x, y),
                Size = new Size(w, 34)
            };
            btn.FlatAppearance.BorderSize = 0;
            if (primary) btn.Font = new Font("Yu Gothic UI", 10F, FontStyle.Bold);
            return btn;
        }

        // 💬 ステータス表示を更新する
        private void SetStatus(string msg) { statusLabel.Text = msg; }

        private string CurrentMethod() => MethodIds[methodBox.SelectedIndex];

        // 👁️ ずらし幅の入力はシーザー暗号のときだけ見せる
        private void UpdateShiftVisibility()
        {
            bool show = CurrentMethod() == "caesar";
            shiftLabel.Visible = show;
            shiftBox.Visible = show;
        }

        // 🔐／🔓 変換を実行する（空入力はメッセージだけ出す）
        private void Run(bool decrypt)
        {
            if (inputBox.Text.Length == 0)
            {
                SetStatus(decrypt ? "復号したい文章を入力してください。" : "元の文章を入力してください。");
                return;
            }
            string method = CurrentMethod();
            outputBox.Text = Cipher.Convert(inputBox.Text, method, (int)shiftBox.Value, decrypt);
            SetStatus(MethodNames[methodBox.SelectedIndex] + (decrypt ? "で復号しました。" : "で暗号化しました。"));
        }

        /* ===== 🃏 問題カード（PNG 1200×630、Web 版 drawCard と同じレイアウト） ===== */

        // 📝 描画幅に合わせてテキストを折り返す（段落＝改行は保持する）
        private static List<string> WrapText(Graphics g, string text, Font font, float maxWidth)
        {
            var lines = new List<string>();
            foreach (var paragraph in text.Split('\n'))
            {
                string line = "";
                foreach (var cp in paragraph.EnumerateRunes())
                {
                    string ch = cp.ToString();
                    string test = line + ch;
                    if (g.MeasureString(test, font).Width > maxWidth && line.Length > 0)
                    {
                        lines.Add(line);
                        line = ch;
                    }
                    else
                    {
                        line = test;
                    }
                }
                lines.Add(line);
            }
            return lines;
        }

        // 🃏 カードを描いて PNG で保存する。7行を超える場合は保存せずメッセージを出す
        private void SaveCard()
        {
            if (inputBox.Text.Length == 0)
            {
                SetStatus("カードにする文章を「元の文章」に入力してください。");
                return;
            }
            string method = CurrentMethod();
            string problem = Cipher.Convert(inputBox.Text, method, (int)shiftBox.Value, false);
            string hint = hintBox.Text.Trim();

            const int W = 1200, H = 630;
            using (var bmp = new Bitmap(W, H))
            using (var g = Graphics.FromImage(bmp))
            {
                var problemFont = new Font("Yu Gothic UI", 40F);
                var lines = WrapText(g, problem, problemFont, W - 128);
                if (lines.Count > 7)
                {
                    SetStatus("問題文がカードの上限（7行）を超えています。本文を短くしてから作成してください。");
                    return;
                }

                // 🎨 背景・上部の帯・枠
                g.Clear(Color.FromArgb(0x23, 0x23, 0x38));
                using (var barBrush = new SolidBrush(Color.FromArgb(0x43, 0x38, 0xca)))
                    g.FillRectangle(barBrush, 0, 0, W, 14);
                using (var pen = new Pen(Color.FromArgb(0x81, 0x8c, 0xf8), 3))
                    g.DrawRectangle(pen, 24, 24, W - 48, H - 48);

                // 🏷️ 見出しと方式名（GDI+ は左上原点のため、Web 版のベースライン位置から字高を引いた位置に置く）
                using (var b = new SolidBrush(Color.FromArgb(0xa5, 0xb4, 0xfc)))
                using (var f = new Font("Yu Gothic UI", 30F, FontStyle.Bold))
                    g.DrawString("なぞとき問題カード", f, b, 64, 62);

                using (var b = new SolidBrush(Color.White))
                using (var f = new Font("Yu Gothic UI", 34F, FontStyle.Bold))
                    g.DrawString("方式：" + MethodNames[methodBox.SelectedIndex], f, b, 64, 118);

                // 📖 問題文（開始176・行間44）
                using (var b = new SolidBrush(Color.White))
                {
                    float y = 176;
                    foreach (var line in lines)
                    {
                        g.DrawString(line, problemFont, b, 64, y);
                        y += 44;
                    }
                }

                // 💡 ヒント欄（488〜552 の帯に1行だけ）
                if (hint.Length > 0)
                {
                    int hintY = H - 104;
                    using (var b = new SolidBrush(Color.FromArgb(0x2e, 0x2e, 0x4a)))
                        g.FillRectangle(b, 64, hintY - 38, W - 128, 64);
                    using (var b = new SolidBrush(Color.FromArgb(0xfb, 0xbf, 0x24)))
                    using (var f = new Font("Yu Gothic UI", 28F, FontStyle.Bold))
                    {
                        var hintLines = WrapText(g, "ヒント：" + hint, f, W - 176);
                        g.DrawString(hintLines[0], f, b, 88, hintY - 24);
                    }
                }

                // 📎 フッター
                using (var b = new SolidBrush(Color.FromArgb(0x8b, 0x8b, 0xa7)))
                using (var f = new Font("Yu Gothic UI", 24F))
                    g.DrawString("nazoya — 謎解き・暗号メーカー", f, b, 64, H - 68);

                using (var dlg = new SaveFileDialog())
                {
                    dlg.FileName = "nazoya-card.png";
                    dlg.Filter = "PNG画像|*.png";
                    if (dlg.ShowDialog(this) != DialogResult.OK) return;
                    bmp.Save(dlg.FileName, ImageFormat.Png);
                }
            }
            SetStatus("問題カードを保存しました。");
        }
    }
}
