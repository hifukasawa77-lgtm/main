using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Windows;
using SakuraLikeEditor.Services;

namespace SakuraLikeEditor.Views;

public partial class GrepWindow : Window
{
    private readonly Action<string, int>? _openFileAtLine;
    private readonly ObservableCollection<GrepBlockViewModel> _items = new();

    public GrepWindow(Action<string, int>? openFileAtLine)
    {
        InitializeComponent();
        _openFileAtLine = openFileAtLine;
        ResultsListBox.ItemsSource = _items;
        Loaded += (_, _) => PatternTextBox.Focus();
    }

    private void Browse_Click(object sender, RoutedEventArgs e)
    {
        var folder = FolderPicker.PickFolder(this, FolderTextBox.Text);
        if (!string.IsNullOrWhiteSpace(folder))
        {
            FolderTextBox.Text = folder;
        }
    }

    private async void Search_Click(object sender, RoutedEventArgs e)
    {
        SearchButton.IsEnabled = false;
        try
        {
            _items.Clear();
            StatusTextBlock.Text = "Searching...";

            var folder = FolderTextBox.Text?.Trim() ?? "";
            var pattern = PatternTextBox.Text ?? "";
            var filePatterns = FilesTextBox.Text ?? "";
            var useRegex = RegexCheckBox.IsChecked == true;
            var matchCase = MatchCaseCheckBox.IsChecked == true;

            var context = 3;
            _ = int.TryParse(ContextTextBox.Text, out context);

            var options = new GrepOptions(
                RootFolder: folder,
                Pattern: pattern,
                UseRegex: useRegex,
                MatchCase: matchCase,
                FilePatterns: filePatterns,
                ContextLines: context);

            var sw = Stopwatch.StartNew();
            var blocks = await Task.Run(() => GrepService.GrepWithContext(options, CancellationToken.None));
            sw.Stop();

            foreach (var b in blocks)
            {
                _items.Add(new GrepBlockViewModel(b));
            }

            StatusTextBlock.Text = $"Blocks: {blocks.Count}  (Context: {context})  Time: {sw.ElapsedMilliseconds} ms";
        }
        catch (Exception ex)
        {
            StatusTextBlock.Text = "Failed.";
            System.Windows.MessageBox.Show(this, ex.Message, "Grep", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            SearchButton.IsEnabled = true;
        }
    }

    private void ResultsListBox_MouseDoubleClick(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (ResultsListBox.SelectedItem is not GrepBlockViewModel item) return;
        _openFileAtLine?.Invoke(item.FilePath, item.FirstMatchLine);
    }

    private sealed class GrepBlockViewModel
    {
        public GrepBlockViewModel(GrepBlock block)
        {
            FilePath = block.FilePath;
            StartLine = block.StartLine;
            EndLine = block.EndLine;
            FirstMatchLine = block.FirstMatchLine;
            Body = block.Text.TrimEnd();
            Header = $"{block.FilePath}  (Ln {block.StartLine} - {block.EndLine})";
        }

        public string FilePath { get; }
        public int StartLine { get; }
        public int EndLine { get; }
        public int FirstMatchLine { get; }
        public string Header { get; }
        public string Body { get; }
    }
}
