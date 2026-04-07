using System.Text;

namespace SakuraLikeEditor.Services;

public static class CsvService
{
    public static List<List<string>> Parse(string text, char delimiter)
    {
        // RFC4180-ish parser with quoted fields, escaped quotes, and newlines inside quotes.
        var rows = new List<List<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];

            if (inQuotes)
            {
                if (c == '"')
                {
                    var nextIsQuote = i + 1 < text.Length && text[i + 1] == '"';
                    if (nextIsQuote)
                    {
                        field.Append('"');
                        i++;
                        continue;
                    }

                    inQuotes = false;
                    continue;
                }

                field.Append(c);
                continue;
            }

            if (c == '"')
            {
                inQuotes = true;
                continue;
            }

            if (c == delimiter)
            {
                row.Add(field.ToString());
                field.Clear();
                continue;
            }

            if (c == '\r')
            {
                if (i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(field.ToString());
                field.Clear();
                rows.Add(row);
                row = new List<string>();
                continue;
            }

            if (c == '\n')
            {
                row.Add(field.ToString());
                field.Clear();
                rows.Add(row);
                row = new List<string>();
                continue;
            }

            field.Append(c);
        }

        row.Add(field.ToString());
        rows.Add(row);

        // Drop trailing empty last line (common when file ends with newline).
        if (rows.Count >= 2 && rows[^1].Count == 1 && rows[^1][0].Length == 0)
        {
            rows.RemoveAt(rows.Count - 1);
        }

        return rows;
    }

    public static string Serialize(List<List<string>> rows, char delimiter, string newline = "\r\n")
    {
        var sb = new StringBuilder();
        for (var r = 0; r < rows.Count; r++)
        {
            var row = rows[r];
            for (var c = 0; c < row.Count; c++)
            {
                if (c > 0) sb.Append(delimiter);
                sb.Append(Escape(row[c], delimiter));
            }

            if (r != rows.Count - 1) sb.Append(newline);
        }
        return sb.ToString();
    }

    public static string ColumnName(int index0)
    {
        // 0 -> A, 25 -> Z, 26 -> AA
        var i = index0 + 1;
        var sb = new StringBuilder();
        while (i > 0)
        {
            i--;
            sb.Insert(0, (char)('A' + (i % 26)));
            i /= 26;
        }
        return sb.ToString();
    }

    private static string Escape(string value, char delimiter)
    {
        value ??= "";
        var needsQuote = value.Contains(delimiter) || value.Contains('"') || value.Contains('\r') || value.Contains('\n');
        if (!needsQuote) return value;
        return "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }
}

