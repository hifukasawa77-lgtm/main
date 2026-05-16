// =============================================================
//  Claude AI Unity Assistant
//  配置場所: Assets/Editor/ClaudeAssistant.cs
//  Unityメニュー: Tools > 🤖 Claude AI Assistant
//
//  必要: Google AI Studio (https://aistudio.google.com/) で
//        無料の Gemini API キーを取得してウィンドウに入力
// =============================================================

#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Text.RegularExpressions;

public class ClaudeAssistant : EditorWindow
{
    // ─── State ───────────────────────────────────────────────
    private string prompt      = "";
    private string scriptName  = "GeneratedScript";
    private string apiKey      = "";
    private string status      = "";
    private bool   isGenerating = false;
    private Vector2 statusScroll;

    private const string PREFS_KEY  = "ClaudeAssistant_GeminiKey";
    private const string ENDPOINT   =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

    private static readonly HttpClient http =
        new HttpClient { Timeout = System.TimeSpan.FromSeconds(40) };

    // ─── Menu ────────────────────────────────────────────────
    [MenuItem("Tools/🤖 Claude AI Assistant")]
    public static void ShowWindow()
    {
        var w = GetWindow<ClaudeAssistant>("🤖 Claude AI");
        w.minSize = new Vector2(430, 540);
    }

    void OnEnable()
    {
        apiKey = EditorPrefs.GetString(PREFS_KEY, "");
    }

    // ─── GUI ─────────────────────────────────────────────────
    void OnGUI()
    {
        var titleStyle = new GUIStyle(EditorStyles.boldLabel) { fontSize = 14 };
        GUILayout.Label("🤖 Claude AI Unity Assistant", titleStyle);
        EditorGUILayout.Space(6);

        // API Key
        EditorGUILayout.LabelField(
            "Gemini API Key  (https://aistudio.google.com/ で無料取得)",
            EditorStyles.miniLabel);
        string newKey = EditorGUILayout.PasswordField(apiKey);
        if (newKey != apiKey)
        {
            apiKey = newKey;
            EditorPrefs.SetString(PREFS_KEY, apiKey);
        }

        EditorGUILayout.Space(10);

        // Prompt
        EditorGUILayout.LabelField("作りたいものを日本語で説明してください", EditorStyles.boldLabel);
        var examples = new GUIStyle(EditorStyles.miniLabel) { wordWrap = true };
        EditorGUILayout.LabelField(
            "例: 「WASDで動く3Dプレイヤー」「弾を自動で発射する敵AI」" +
            "「スコアを管理するゲームマネージャー」「アイテムを取得したら光るエフェクト」",
            examples);
        EditorGUILayout.Space(4);
        prompt = EditorGUILayout.TextArea(prompt, GUILayout.Height(110));

        EditorGUILayout.Space(6);

        // Script name
        EditorGUILayout.BeginHorizontal();
        EditorGUILayout.LabelField("クラス名 (ファイル名):", GUILayout.Width(130));
        scriptName = EditorGUILayout.TextField(scriptName);
        EditorGUILayout.EndHorizontal();

        EditorGUILayout.Space(8);

        // Generate button
        bool canGenerate = !isGenerating
                        && !string.IsNullOrWhiteSpace(apiKey)
                        && prompt.Trim().Length >= 5
                        && !string.IsNullOrWhiteSpace(scriptName);
        GUI.enabled = canGenerate;
        if (GUILayout.Button(isGenerating ? "⏳ 生成中…" : "▶ スクリプトを生成", GUILayout.Height(38)))
            _ = GenerateAsync();
        GUI.enabled = true;

        // Status
        if (!string.IsNullOrEmpty(status))
        {
            EditorGUILayout.Space(8);
            statusScroll = EditorGUILayout.BeginScrollView(statusScroll, GUILayout.Height(170));
            EditorGUILayout.TextArea(status, GUILayout.ExpandHeight(true));
            EditorGUILayout.EndScrollView();
        }

        // Help
        EditorGUILayout.Space(4);
        EditorGUILayout.HelpBox(
            "生成されたスクリプトは Assets/Scripts/Generated/ に保存されます。\n" +
            "GameObjectにD&DするかAdd Componentで追加してください。",
            MessageType.Info);
    }

    // ─── Generate ────────────────────────────────────────────
    async Task GenerateAsync()
    {
        isGenerating = true;
        status = "⏳ Gemini API に問い合わせ中…";
        Repaint();

        string className = SanitizeClassName(scriptName);
        string sysPrompt =
            "あなたはUnityゲーム開発の専門家です。\n" +
            "ユーザーの説明をもとにUnity C#スクリプトを1つ生成してください。\n" +
            "【厳守事項】\n" +
            "・```csharp や ``` などのマークダウン記号は絶対に使わない\n" +
            "・説明文・コメントブロックも不要\n" +
            "・C#コードのみを出力する（最初の行は必ず using 文）\n" +
            "・クラス名は必ず " + className + " にする\n" +
            "・MonoBehaviourを継承すること\n" +
            "・実際に動作する完全なコードを生成すること\n" +
            "・publicフィールドはSerializeFieldで Inspector に表示する";

        try
        {
            string body =
                "{" +
                "\"system_instruction\":{\"parts\":[{\"text\":" + Jstr(sysPrompt) + "}]}," +
                "\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":" + Jstr(prompt) + "}]}]," +
                "\"generationConfig\":{\"maxOutputTokens\":2500,\"temperature\":0.2}" +
                "}";

            var res = await http.PostAsync(
                ENDPOINT + "?key=" + apiKey,
                new StringContent(body, Encoding.UTF8, "application/json"));

            string raw = await res.Content.ReadAsStringAsync();

            if (!res.IsSuccessStatusCode)
            {
                status = "❌ API エラー " + (int)res.StatusCode + "\n" + raw;
                return;
            }

            string code = ExtractText(raw).Trim();

            // マークダウンフェンスが混入した場合に除去
            code = Regex.Replace(code, @"^```[a-zA-Z]*\s*", "", RegexOptions.Multiline);
            code = code.Replace("```", "").Trim();

            if (string.IsNullOrWhiteSpace(code))
            {
                status = "⚠️ 空のレスポンスです。説明を変えてもう一度お試しください。";
                return;
            }

            // クラス名が指定通りか確認・補正
            if (!code.Contains("class " + className))
            {
                code = Regex.Replace(code,
                    @"class\s+\w+\s*:",
                    "class " + className + " :");
            }

            // ファイル保存
            string dir  = Path.Combine(Application.dataPath, "Scripts", "Generated");
            Directory.CreateDirectory(dir);
            string path = Path.Combine(dir, className + ".cs");
            File.WriteAllText(path, code, new UTF8Encoding(false));
            AssetDatabase.Refresh();

            // 相対パス表示
            string relPath = "Assets/Scripts/Generated/" + className + ".cs";

            status =
                "✅ 生成完了！\n" +
                "ファイル: " + relPath + "\n\n" +
                "【使い方】\n" +
                "1. Hierarchy でスクリプトを適用するGameObjectを選択\n" +
                "2. Inspector の「Add Component」をクリック\n" +
                "3. 「" + className + "」を検索して追加\n\n" +
                "【生成コード（先頭200文字）】\n" +
                code.Substring(0, Mathf.Min(200, code.Length)) + "…";

            // Project ウィンドウで生成ファイルをハイライト
            var asset = AssetDatabase.LoadAssetAtPath<MonoScript>(relPath);
            if (asset != null) EditorGUIUtility.PingObject(asset);
        }
        catch (System.Exception e)
        {
            status = "❌ " + e.GetType().Name + ": " + e.Message;
        }
        finally
        {
            isGenerating = false;
            Repaint();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────

    static string SanitizeClassName(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "GeneratedScript";
        s = Regex.Replace(s, @"[^\w]", "");
        if (s.Length == 0) return "GeneratedScript";
        if (char.IsDigit(s[0])) s = "_" + s;
        return s;
    }

    // JSON 文字列エスケープ
    static string Jstr(string s) =>
        "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\n", "\\n").Replace("\r", "\\r")
                .Replace("\t", "\\t") + "\"";

    // Gemini レスポンスから text フィールドを抽出
    static string ExtractText(string json)
    {
        int idx = json.IndexOf("\"text\"");
        if (idx < 0) return "";
        idx = json.IndexOf(':', idx) + 1;
        while (idx < json.Length && (json[idx] == ' ' || json[idx] == '\t')) idx++;
        if (idx >= json.Length || json[idx] != '"') return "";
        idx++; // 開始クォートをスキップ

        var sb = new StringBuilder();
        while (idx < json.Length)
        {
            char c = json[idx];
            if (c == '\\' && idx + 1 < json.Length)
            {
                char n = json[++idx];
                switch (n)
                {
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case '"': sb.Append('"');  break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    default:  sb.Append(n);   break;
                }
            }
            else if (c == '"') break;
            else sb.Append(c);
            idx++;
        }
        return sb.ToString();
    }
}
#endif
