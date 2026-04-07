using System.IO;
using System.Text;
using SakuraLikeEditor.Models;

namespace SakuraLikeEditor.Services;

public static class TextFileService
{
    public static (string text, Encoding encoding, bool hasBom, NewlineKind newlineKind) ReadAllTextAuto(string path)
    {
        var bytes = File.ReadAllBytes(path);
        return ReadAllTextAutoFromBytes(bytes);
    }

    public static (string text, Encoding encoding, bool hasBom, NewlineKind newlineKind, bool truncated, long totalBytes) ReadPreviewTextAuto(string path, int maxBytes)
    {
        var fi = new FileInfo(path);
        var totalBytes = fi.Length;
        if (totalBytes <= maxBytes)
        {
            var bytesFull = File.ReadAllBytes(path);
            var full = ReadAllTextAutoFromBytes(bytesFull);
            return (full.text, full.encoding, full.hasBom, full.newlineKind, false, totalBytes);
        }

        var bytes = ReadFirstBytes(path, maxBytes);
        var preview = ReadAllTextAutoFromBytes(bytes);
        return (preview.text, preview.encoding, preview.hasBom, preview.newlineKind, true, totalBytes);
    }

    public static void WriteAllText(string path, string textBoxText, Encoding encoding, bool writeBom, NewlineKind newlineKind)
    {
        var normalized = NormalizeFromTextBoxNewlines(textBoxText, newlineKind);

        if (encoding is UTF8Encoding)
        {
            var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: writeBom);
            File.WriteAllText(path, normalized, utf8);
            return;
        }

        File.WriteAllText(path, normalized, encoding);
    }

    private static bool TryReadBom(byte[] bytes, out Encoding encoding, out int bomLength)
    {
        encoding = Encoding.UTF8;
        bomLength = 0;

        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
        {
            encoding = new UTF8Encoding(false);
            bomLength = 3;
            return true;
        }

        if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
        {
            encoding = Encoding.Unicode; // UTF-16 LE
            bomLength = 2;
            return true;
        }

        if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
        {
            encoding = Encoding.BigEndianUnicode; // UTF-16 BE
            bomLength = 2;
            return true;
        }

        if (bytes.Length >= 4 && bytes[0] == 0xFF && bytes[1] == 0xFE && bytes[2] == 0x00 && bytes[3] == 0x00)
        {
            encoding = new UTF32Encoding(bigEndian: false, byteOrderMark: true);
            bomLength = 4;
            return true;
        }

        if (bytes.Length >= 4 && bytes[0] == 0x00 && bytes[1] == 0x00 && bytes[2] == 0xFE && bytes[3] == 0xFF)
        {
            encoding = new UTF32Encoding(bigEndian: true, byteOrderMark: true);
            bomLength = 4;
            return true;
        }

        return false;
    }

    private static Encoding? GuessLegacyJapaneseEncoding(byte[] bytes)
    {
        // Heuristic: try strict decoders and pick the first that succeeds.
        // If both succeed, prefer CP932 (typical business files) unless EUC-JP looks more plausible.
        Encoding? cp932 = null;
        Encoding? eucJp = null;
        string? cp932Text = null;
        string? eucJpText = null;

        try
        {
            cp932 = Encoding.GetEncoding(932, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            cp932Text = cp932.GetString(bytes);
        }
        catch
        {
            cp932 = null;
        }

        try
        {
            // EUC-JP: code page 51932
            eucJp = Encoding.GetEncoding(51932, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            eucJpText = eucJp.GetString(bytes);
        }
        catch
        {
            eucJp = null;
        }

        if (cp932 == null && eucJp == null) return null;
        if (cp932 != null && eucJp == null) return Encoding.GetEncoding(932);
        if (cp932 == null && eucJp != null) return Encoding.GetEncoding(51932);

        // Both decoded: score by presence of typical Japanese ranges and fewer control chars.
        var cpScore = ScoreJapaneseText(cp932Text!);
        var eucScore = ScoreJapaneseText(eucJpText!);
        return cpScore >= eucScore ? Encoding.GetEncoding(932) : Encoding.GetEncoding(51932);
    }

    private static int ScoreJapaneseText(string text)
    {
        var score = 0;
        foreach (var c in text)
        {
            if (c is '\uFFFD') score -= 10;
            if (char.IsControl(c) && c is not '\r' and not '\n' and not '\t') score -= 2;

            // Hiragana/Katakana/CJK
            if (c is >= '\u3040' and <= '\u30FF') score += 2;
            if (c is >= '\u4E00' and <= '\u9FFF') score += 2;
            if (c is >= '\uFF61' and <= '\uFF9F') score += 1; // halfwidth kana
        }
        return score;
    }

    private static (string text, Encoding encoding, bool hasBom, NewlineKind newlineKind) ReadAllTextAutoFromBytes(byte[] bytes)
    {
        if (TryReadBom(bytes, out var bomEncoding, out var bomLength))
        {
            var textBom = bomEncoding.GetString(bytes, bomLength, bytes.Length - bomLength);
            return (NormalizeToTextBoxNewlines(textBom), bomEncoding, true, DetectNewlineKind(textBom));
        }

        // Try strict UTF-8 first; if invalid, try strict legacy Japanese encodings.
        try
        {
            var strictUtf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
            var textUtf8 = strictUtf8.GetString(bytes);
            return (NormalizeToTextBoxNewlines(textUtf8), new UTF8Encoding(false), false, DetectNewlineKind(textUtf8));
        }
        catch (DecoderFallbackException)
        {
            var guessed = GuessLegacyJapaneseEncoding(bytes) ?? Encoding.GetEncoding(932);
            var text = guessed.GetString(bytes);
            return (NormalizeToTextBoxNewlines(text), guessed, false, DetectNewlineKind(text));
        }
    }

    private static byte[] ReadFirstBytes(string path, int maxBytes)
    {
        using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var toRead = (int)Math.Min(maxBytes, fs.Length);
        var buffer = new byte[toRead];
        var read = 0;
        while (read < toRead)
        {
            var n = fs.Read(buffer, read, toRead - read);
            if (n <= 0) break;
            read += n;
        }
        if (read == buffer.Length) return buffer;
        return buffer.AsSpan(0, read).ToArray();
    }

    private static NewlineKind DetectNewlineKind(string text)
    {
        if (text.Contains("\r\n", StringComparison.Ordinal)) return NewlineKind.CrLf;
        if (text.Contains('\r', StringComparison.Ordinal)) return NewlineKind.Cr;
        return NewlineKind.Lf;
    }

    private static string NormalizeToTextBoxNewlines(string text)
    {
        // WPF TextBox expects CRLF; normalize to keep caret math stable.
        // Handle files that are LF-only or CR-only by converting to CRLF.
        return text
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace("\r", "\n", StringComparison.Ordinal)
            .Replace("\n", "\r\n", StringComparison.Ordinal);
    }

    private static string NormalizeFromTextBoxNewlines(string textBoxText, NewlineKind newlineKind)
    {
        return newlineKind switch
        {
            NewlineKind.CrLf => textBoxText,
            NewlineKind.Lf => textBoxText.Replace("\r\n", "\n", StringComparison.Ordinal),
            NewlineKind.Cr => textBoxText.Replace("\r\n", "\r", StringComparison.Ordinal),
            _ => textBoxText,
        };
    }
}
