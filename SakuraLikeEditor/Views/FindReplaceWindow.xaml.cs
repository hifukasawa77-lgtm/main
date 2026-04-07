using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;

namespace SakuraLikeEditor.Views;

public partial class FindReplaceWindow : Window
{
    private TextBox? _editor;
    private int _lastIndex;
    private const int MaxHistory = 20;

    public FindReplaceWindow()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            ReloadHistory();
            FindComboBox.Focus();
        };
    }

    public void SetTargetEditor(TextBox? editor)
    {
        _editor = editor;
        _lastIndex = 0;
    }

    public void SetFindText(string text)
    {
        FindComboBox.Text = text;
        FindComboBox.IsDropDownOpen = false;
        FindComboBox.Dispatcher.InvokeAsync(() =>
        {
            if (FindComboBox.Template?.FindName("PART_EditableTextBox", FindComboBox) is TextBox tb)
            {
                tb.SelectAll();
            }
        });
    }

    public void FocusReplaceBox()
    {
        ReplaceTextBox.Focus();
        ReplaceTextBox.SelectAll();
    }

    private void FindNext_Click(object sender, RoutedEventArgs e)
    {
        if (_editor == null) return;

        AddHistory(GetFindText());
        if (!TryFindNext(out var index, out var length)) return;

        _editor.Focus();
        _editor.Select(index, length);
        _editor.ScrollToLine(_editor.GetLineIndexFromCharacterIndex(index));
        ResultTextBlock.Text = $"Found at {index + 1}.";
    }

    private void Replace_Click(object sender, RoutedEventArgs e)
    {
        if (_editor == null) return;

        var find = GetFindText();
        if (find.Length == 0) return;

        AddHistory(find);

        if (RegexCheckBox.IsChecked == true)
        {
            if (!TryFindNext(out var index, out var length)) return;
            _editor.Select(index, length);
            _editor.SelectedText = ReplaceTextBox.Text ?? "";
            ResultTextBlock.Text = "Replaced match.";
            return;
        }

        if (_editor.SelectionLength == find.Length && string.Equals(_editor.SelectedText, find, GetComparison()))
        {
            _editor.SelectedText = ReplaceTextBox.Text ?? "";
            ResultTextBlock.Text = "Replaced selection.";
        }
        else
        {
            FindNext_Click(sender, e);
        }
    }

    private void ReplaceAll_Click(object sender, RoutedEventArgs e)
    {
        if (_editor == null) return;

        var find = GetFindText();
        if (find.Length == 0) return;

        var replace = ReplaceTextBox.Text ?? "";
        var text = _editor.Text ?? "";

        AddHistory(find);

        if (RegexCheckBox.IsChecked == true)
        {
            try
            {
                var regex = BuildRegex(find);
                var matches = regex.Matches(text);
                var replaced = matches.Count;
                text = regex.Replace(text, replace);
                _editor.Text = text;
                ResultTextBlock.Text = $"Replaced: {replaced}.";
                return;
            }
            catch (Exception ex)
            {
                ResultTextBlock.Text = $"Regex error: {ex.Message}";
                return;
            }
        }

        var comparison = GetComparison();
        var replacedPlain = 0;
        var startIndex = 0;

        while (true)
        {
            var index = text.IndexOf(find, startIndex, comparison);
            if (index < 0) break;
            if (WholeWordCheckBox.IsChecked == true && !IsWholeWordMatch(text, index, find.Length))
            {
                startIndex = index + find.Length;
                continue;
            }

            text = string.Concat(text.AsSpan(0, index), replace, text.AsSpan(index + find.Length));
            startIndex = index + replace.Length;
            replacedPlain++;
        }

        _editor.Text = text;
        ResultTextBlock.Text = $"Replaced: {replacedPlain}.";
    }

    private bool TryFindNext(out int index, out int length)
    {
        index = -1;
        length = 0;

        if (_editor == null) return false;

        var find = GetFindText();
        if (find.Length == 0) return false;

        var text = _editor.Text ?? "";
        var start = _editor.SelectionStart + _editor.SelectionLength;

        if (RegexCheckBox.IsChecked == true)
        {
            try
            {
                var regex = BuildRegex(find);

                var match = regex.Match(text, Math.Clamp(start, 0, text.Length));
                if (!match.Success)
                {
                    match = regex.Match(text, 0);
                }

                if (!match.Success)
                {
                    ResultTextBlock.Text = "Not found.";
                    return false;
                }

                _lastIndex = match.Index;
                index = match.Index;
                length = match.Length;
                return true;
            }
            catch (Exception ex)
            {
                ResultTextBlock.Text = $"Regex error: {ex.Message}";
                return false;
            }
        }

        var comparison = GetComparison();
        var i = text.IndexOf(find, Math.Clamp(start, 0, text.Length), comparison);
        if (i < 0)
        {
            i = text.IndexOf(find, 0, comparison);
        }

        while (i >= 0 && WholeWordCheckBox.IsChecked == true && !IsWholeWordMatch(text, i, find.Length))
        {
            i = text.IndexOf(find, i + find.Length, comparison);
        }

        if (i < 0)
        {
            ResultTextBlock.Text = "Not found.";
            return false;
        }

        _lastIndex = i;
        index = i;
        length = find.Length;
        return true;
    }

    private StringComparison GetComparison()
        => MatchCaseCheckBox.IsChecked == true ? StringComparison.CurrentCulture : StringComparison.CurrentCultureIgnoreCase;

    private Regex BuildRegex(string pattern)
    {
        var options = RegexOptions.Multiline;
        if (MatchCaseCheckBox.IsChecked != true) options |= RegexOptions.IgnoreCase;

        // Whole word with regex is ambiguous for Japanese; keep it simple: apply only for non-regex mode.
        return new Regex(pattern, options);
    }

    private string GetFindText()
        => FindComboBox.Text ?? "";

    private void ReloadHistory()
    {
        FindComboBox.ItemsSource = null;
        FindComboBox.ItemsSource = App.Settings.FindHistory.ToList();
    }

    private void AddHistory(string find)
    {
        find = find.Trim();
        if (find.Length == 0) return;

        var list = App.Settings.FindHistory;
        list.RemoveAll(x => string.Equals(x, find, StringComparison.Ordinal));
        list.Insert(0, find);
        if (list.Count > MaxHistory) list.RemoveRange(MaxHistory, list.Count - MaxHistory);

        ReloadHistory();
        FindComboBox.Text = find;
    }

    private static bool IsWholeWordMatch(string text, int index, int length)
    {
        var beforeIndex = index - 1;
        var afterIndex = index + length;

        var beforeOk = beforeIndex < 0 || !IsWordChar(text[beforeIndex]);
        var afterOk = afterIndex >= text.Length || !IsWordChar(text[afterIndex]);
        return beforeOk && afterOk;
    }

    private static bool IsWordChar(char c)
        => char.IsLetterOrDigit(c) || c == '_' || c >= 0x80;
}
