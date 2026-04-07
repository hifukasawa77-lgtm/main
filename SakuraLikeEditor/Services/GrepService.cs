using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using SakuraLikeEditor.Models;

namespace SakuraLikeEditor.Services;

public sealed record GrepOptions(
    string RootFolder,
    string Pattern,
    bool UseRegex,
    bool MatchCase,
    string FilePatterns,
    int ContextLines);

public sealed record GrepBlock(string FilePath, int StartLine, int EndLine, int FirstMatchLine, string Text);

public static class GrepService
{
    public static List<GrepBlock> GrepWithContext(GrepOptions options, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(options.RootFolder)) throw new ArgumentException("Root folder is empty.");
        if (!Directory.Exists(options.RootFolder)) throw new DirectoryNotFoundException(options.RootFolder);
        if (string.IsNullOrWhiteSpace(options.Pattern)) return new List<GrepBlock>();

        var context = Math.Clamp(options.ContextLines, 0, 500);
        var matcher = BuildMatcher(options.Pattern, options.UseRegex, options.MatchCase);
        var globs = SplitPatterns(options.FilePatterns);
        var globRegexes = globs.Select(GlobToRegex).ToList();

        var blocks = new List<GrepBlock>();

        foreach (var file in EnumerateFilesSafe(options.RootFolder))
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (globRegexes.Count > 0 && !globRegexes.Any(r => r.IsMatch(Path.GetFileName(file))))
            {
                continue;
            }

            try
            {
                var matchLines = FindMatchLineNumbers(file, matcher, cancellationToken);
                if (matchLines.Count == 0) continue;

                var ranges = MergeRanges(matchLines, context);
                var fileBlocks = BuildBlocks(file, ranges, matchLines, matcher, cancellationToken);
                blocks.AddRange(fileBlocks);
            }
            catch
            {
                // ignore unreadable files
            }
        }

        return blocks;
    }

    private static Func<string, bool> BuildMatcher(string pattern, bool useRegex, bool matchCase)
    {
        if (!useRegex)
        {
            var comp = matchCase ? StringComparison.CurrentCulture : StringComparison.CurrentCultureIgnoreCase;
            return line => line.IndexOf(pattern, comp) >= 0;
        }

        var options = RegexOptions.Multiline;
        if (!matchCase) options |= RegexOptions.IgnoreCase;
        var regex = new Regex(pattern, options);
        return line => regex.IsMatch(line);
    }

    private static HashSet<int> FindMatchLineNumbers(string filePath, Func<string, bool> matcher, CancellationToken ct)
    {
        var matches = new HashSet<int>();
        using var reader = OpenTextReader(filePath);
        var lineNo = 0;
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            ct.ThrowIfCancellationRequested();
            lineNo++;
            if (matcher(line)) matches.Add(lineNo);
        }
        return matches;
    }

    private static List<(int start, int end)> MergeRanges(IEnumerable<int> matchLines, int contextLines)
    {
        var ordered = matchLines.OrderBy(x => x).ToList();
        var ranges = new List<(int start, int end)>();

        foreach (var m in ordered)
        {
            var start = Math.Max(1, m - contextLines);
            var end = m + contextLines;

            if (ranges.Count == 0)
            {
                ranges.Add((start, end));
                continue;
            }

            var last = ranges[^1];
            if (start <= last.end + 1)
            {
                ranges[^1] = (last.start, Math.Max(last.end, end));
            }
            else
            {
                ranges.Add((start, end));
            }
        }

        return ranges;
    }

    private static List<GrepBlock> BuildBlocks(
        string filePath,
        List<(int start, int end)> ranges,
        HashSet<int> matchLines,
        Func<string, bool> matcher,
        CancellationToken ct)
    {
        var results = new List<GrepBlock>();
        if (ranges.Count == 0) return results;

        using var reader = OpenTextReader(filePath);
        var lineNo = 0;
        var rangeIndex = 0;
        var current = ranges[rangeIndex];

        var sb = new StringBuilder();
        var blockStart = 0;
        var blockEnd = 0;
        var firstMatchLine = 0;

        void Flush()
        {
            if (blockStart == 0) return;
            results.Add(new GrepBlock(filePath, blockStart, blockEnd, firstMatchLine, sb.ToString()));
            sb.Clear();
            blockStart = 0;
            blockEnd = 0;
            firstMatchLine = 0;
        }

        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            ct.ThrowIfCancellationRequested();
            lineNo++;

            while (rangeIndex < ranges.Count && lineNo > current.end)
            {
                Flush();
                rangeIndex++;
                if (rangeIndex >= ranges.Count) return results;
                current = ranges[rangeIndex];
            }

            if (lineNo < current.start) continue;
            if (lineNo > current.end) continue;

            if (blockStart == 0)
            {
                blockStart = current.start;
                blockEnd = current.end;
            }
            else
            {
                blockEnd = Math.Max(blockEnd, current.end);
            }

            var isMatch = matchLines.Contains(lineNo) && matcher(line);
            if (isMatch && firstMatchLine == 0) firstMatchLine = lineNo;

            sb.Append(isMatch ? '>' : ' ');
            sb.Append(lineNo.ToString().PadLeft(6));
            sb.Append(": ");
            sb.AppendLine(line);
        }

        Flush();
        return results;
    }

    private static TextReader OpenTextReader(string filePath)
    {
        // Detect encoding from BOM/heuristic on the head, then stream with FileShare.ReadWrite for log files.
        using var fsHead = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        var head = ReadFirstBytes(fsHead, 64 * 1024);

        var (encoding, bomLen) = DetectEncoding(head);

        var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        if (bomLen > 0) fs.Position = bomLen;
        return new StreamReader(fs, encoding, detectEncodingFromByteOrderMarks: false);
    }

    private static (Encoding encoding, int bomLen) DetectEncoding(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
            return (new UTF8Encoding(false), 3);
        if (bytes.Length >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE)
            return (Encoding.Unicode, 2);
        if (bytes.Length >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF)
            return (Encoding.BigEndianUnicode, 2);
        if (bytes.Length >= 4 && bytes[0] == 0xFF && bytes[1] == 0xFE && bytes[2] == 0x00 && bytes[3] == 0x00)
            return (new UTF32Encoding(false, true), 4);
        if (bytes.Length >= 4 && bytes[0] == 0x00 && bytes[1] == 0x00 && bytes[2] == 0xFE && bytes[3] == 0xFF)
            return (new UTF32Encoding(true, true), 4);

        // Try strict UTF-8; fallback to CP932/EUC-JP heuristic (reuse existing logic).
        try
        {
            var strictUtf8 = new UTF8Encoding(false, true);
            _ = strictUtf8.GetString(bytes);
            return (new UTF8Encoding(false), 0);
        }
        catch
        {
            var guessed = GuessLegacyJapaneseEncoding(bytes) ?? Encoding.GetEncoding(932);
            return (guessed, 0);
        }
    }

    private static Encoding? GuessLegacyJapaneseEncoding(byte[] bytes)
    {
        try
        {
            // Use same scoring approach as TextFileService, but keep this file self-contained.
            var cp932Strict = Encoding.GetEncoding(932, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
            var eucStrict = Encoding.GetEncoding(51932, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);

            string? cp = null;
            string? eu = null;

            try { cp = cp932Strict.GetString(bytes); } catch { }
            try { eu = eucStrict.GetString(bytes); } catch { }

            if (cp == null && eu == null) return null;
            if (cp != null && eu == null) return Encoding.GetEncoding(932);
            if (cp == null && eu != null) return Encoding.GetEncoding(51932);

            return ScoreJapanese(cp!) >= ScoreJapanese(eu!) ? Encoding.GetEncoding(932) : Encoding.GetEncoding(51932);
        }
        catch
        {
            return null;
        }
    }

    private static int ScoreJapanese(string text)
    {
        var score = 0;
        foreach (var c in text)
        {
            if (c is '\uFFFD') score -= 10;
            if (char.IsControl(c) && c is not '\r' and not '\n' and not '\t') score -= 2;
            if (c is >= '\u3040' and <= '\u30FF') score += 2;
            if (c is >= '\u4E00' and <= '\u9FFF') score += 2;
            if (c is >= '\uFF61' and <= '\uFF9F') score += 1;
        }
        return score;
    }

    private static byte[] ReadFirstBytes(FileStream fs, int maxBytes)
    {
        var toRead = (int)Math.Min(maxBytes, fs.Length);
        var buffer = new byte[toRead];
        var read = 0;
        while (read < toRead)
        {
            var n = fs.Read(buffer, read, toRead - read);
            if (n <= 0) break;
            read += n;
        }
        return read == buffer.Length ? buffer : buffer.AsSpan(0, read).ToArray();
    }

    private static IEnumerable<string> EnumerateFilesSafe(string rootFolder)
    {
        var pending = new Stack<string>();
        pending.Push(rootFolder);

        while (pending.Count > 0)
        {
            var dir = pending.Pop();
            IEnumerable<string> subDirs;
            IEnumerable<string> files;

            try
            {
                subDirs = Directory.EnumerateDirectories(dir);
                files = Directory.EnumerateFiles(dir);
            }
            catch
            {
                continue;
            }

            foreach (var f in files) yield return f;
            foreach (var sd in subDirs) pending.Push(sd);
        }
    }

    private static List<string> SplitPatterns(string patterns)
        => (patterns ?? "")
            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(p => p.Trim())
            .Where(p => p.Length > 0)
            .ToList();

    private static Regex GlobToRegex(string glob)
    {
        // Supports * and ? on file name only.
        var escaped = Regex.Escape(glob)
            .Replace("\\*", ".*", StringComparison.Ordinal)
            .Replace("\\?", ".", StringComparison.Ordinal);
        return new Regex("^" + escaped + "$", RegexOptions.IgnoreCase);
    }
}

