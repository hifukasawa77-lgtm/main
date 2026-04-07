using System.Text;
using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Microsoft.Win32;
using SakuraLikeEditor.Models;
using SakuraLikeEditor.Services;
using SakuraLikeEditor.Views;

namespace SakuraLikeEditor;

public partial class MainWindow : Window, INotifyPropertyChanged
{
    private readonly System.Windows.Threading.DispatcherTimer _autosaveTimer = new();
    private const int MaxRecentFiles = 20;

    public event PropertyChangedEventHandler? PropertyChanged;

    public MainWindow()
    {
        InitializeComponent();

        AddCommandBindings();

        DocumentsTabControl.SelectionChanged += (_, _) =>
        {
            UpdateStatusBar();
            SyncFindReplaceTarget();
        };

        Loaded += (_, _) =>
        {
            NewDocument();
            UpdateStatusBar();
            ConfigureAutosaveTimer();
        };
    }

    public void OpenFilesFromCommandLine(string[] files)
    {
        foreach (var f in files)
        {
            try
            {
                var fullPath = Path.GetFullPath(f);
                if (File.Exists(fullPath))
                {
                    OpenDocumentPath(fullPath);
                }
            }
            catch
            {
                // ignore invalid args
            }
        }
    }

    private bool _wordWrap = true;
    private bool _showLineNumbers = true;
    private double _zoomFactor = 1.0;
    private FindReplaceWindow? _findReplaceWindow;

    public bool WordWrapEnabled
    {
        get => _wordWrap;
        set
        {
            if (_wordWrap == value) return;
            _wordWrap = value;
            ApplyViewOptionsToAllEditors();
            UpdateStatusBar();
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(WordWrapEnabled)));
        }
    }

    public bool LineNumbersEnabled
    {
        get => _showLineNumbers;
        set
        {
            if (_showLineNumbers == value) return;
            _showLineNumbers = value;
            ApplyViewOptionsToAllEditors();
            UpdateStatusBar();
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(LineNumbersEnabled)));
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!PromptSaveAllIfDirty())
        {
            e.Cancel = true;
            return;
        }

        base.OnClosing(e);
    }

    private void AddCommandBindings()
    {
        CommandBindings.Add(new CommandBinding(MainWindowCommands.NewDocument, (_, _) => NewDocument()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.OpenDocument, (_, _) => OpenDocument()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SaveDocument, (_, _) => SaveDocument()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SaveDocumentAs, (_, _) => SaveDocumentAs()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.ExitApp, (_, _) => Close()));

        CommandBindings.Add(new CommandBinding(MainWindowCommands.Find, (_, _) => ShowFindReplace(isReplace: false)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.Replace, (_, _) => ShowFindReplace(isReplace: true)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.GoToLine, (_, _) => GoToLine()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.Grep, (_, _) => ShowGrep()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.CsvTable, (_, _) => ShowCsvTable()));

        CommandBindings.Add(new CommandBinding(MainWindowCommands.ToggleWordWrap, ToggleWordWrap_Executed));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.ToggleLineNumbers, ToggleLineNumbers_Executed));

        CommandBindings.Add(new CommandBinding(MainWindowCommands.ZoomIn, (_, _) => SetZoom(_zoomFactor + 0.1)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.ZoomOut, (_, _) => SetZoom(_zoomFactor - 0.1)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.ZoomReset, (_, _) => SetZoom(1.0)));

        CommandBindings.Add(new CommandBinding(MainWindowCommands.ToggleBookmark, (_, _) => ToggleBookmark()));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.NextBookmark, (_, _) => GoToNextBookmark(isPrev: false)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.PrevBookmark, (_, _) => GoToNextBookmark(isPrev: true)));

        CommandBindings.Add(new CommandBinding(MainWindowCommands.SetEncodingUtf8NoBom, (_, _) => SetActiveEncoding(new UTF8Encoding(false), writeBom: false)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SetEncodingUtf8Bom, (_, _) => SetActiveEncoding(new UTF8Encoding(false), writeBom: true)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SetEncodingShiftJis, (_, _) => SetActiveEncoding(Encoding.GetEncoding(932), writeBom: false)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SetEncodingEucJp, (_, _) => SetActiveEncoding(Encoding.GetEncoding(51932), writeBom: false)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SetEncodingUtf16Le, (_, _) => SetActiveEncoding(Encoding.Unicode, writeBom: false)));
        CommandBindings.Add(new CommandBinding(MainWindowCommands.SetEncodingUtf32Le, (_, _) => SetActiveEncoding(new UTF32Encoding(bigEndian: false, byteOrderMark: true), writeBom: false)));
    }

    private void ToggleWordWrap_Executed(object sender, ExecutedRoutedEventArgs e)
    {
        bool? desired = e.OriginalSource switch
        {
            MenuItem mi => mi.IsChecked,
            ToggleButton tb => tb.IsChecked,
            _ => null,
        };
        WordWrapEnabled = desired ?? !WordWrapEnabled;
    }

    private void ToggleLineNumbers_Executed(object sender, ExecutedRoutedEventArgs e)
    {
        bool? desired = e.OriginalSource switch
        {
            MenuItem mi => mi.IsChecked,
            ToggleButton tb => tb.IsChecked,
            _ => null,
        };
        LineNumbersEnabled = desired ?? !LineNumbersEnabled;
    }

    private void ApplyViewOptionsToAllEditors()
    {
        foreach (var tab in DocumentsTabControl.Items.OfType<TabItem>())
        {
            if (tab.Content is not EditorView view) continue;
            view.WordWrap = _wordWrap;
            view.ShowLineNumbers = _showLineNumbers;
            view.SetZoomFactor(_zoomFactor);
        }
    }

    private void SetZoom(double zoomFactor)
    {
        _zoomFactor = Math.Clamp(zoomFactor, 0.5, 3.0);
        ApplyViewOptionsToAllEditors();
        UpdateStatusBar();
    }

    private void SetActiveEncoding(Encoding encoding, bool writeBom)
    {
        var doc = GetActiveDocument();
        if (doc == null) return;
        doc.Encoding = encoding;
        doc.WriteBom = writeBom;
        doc.IsDirty = true;
        UpdateStatusBar();
    }

    private void NewDocument()
    {
        var doc = new EditorDocument
        {
            FilePath = null,
            Encoding = new UTF8Encoding(false),
            WriteBom = false,
            NewlineKind = NewlineKind.CrLf,
            IsDirty = false,
        };

        var view = CreateEditorView();
        view.SetTextWithoutDirtyingUndo("");

        var tab = CreateTab(doc, view);
        DocumentsTabControl.Items.Add(tab);
        DocumentsTabControl.SelectedItem = tab;

        UpdateWindowTitle();
    }

    private void OpenDocument()
    {
        var dlg = new OpenFileDialog
        {
            Filter = "Text files|*.txt;*.md;*.log;*.csv;*.json;*.xml;*.yml;*.yaml;*.ini;*.cs;*.js;*.ts;*.html;*.css|All files|*.*",
            Multiselect = false,
        };

        if (dlg.ShowDialog(this) != true) return;

        var fullPath = Path.GetFullPath(dlg.FileName);
        OpenDocumentPath(fullPath);

        UpdateWindowTitle();
        UpdateStatusBar();
    }

    private void OpenDocumentPath(string fullPath)
    {
        var existing = FindTabByPath(fullPath);
        if (existing != null)
        {
            DocumentsTabControl.SelectedItem = existing;
            return;
        }

        try
        {
            string text;
            Encoding encoding;
            bool hasBom;
            NewlineKind newlineKind;
            var isTruncated = false;
            var isReadOnly = false;

            var fi = new FileInfo(fullPath);
            const long previewThresholdBytes = 50L * 1024 * 1024; // 50MB
            const int previewBytes = 10 * 1024 * 1024; // 10MB

            if (fi.Exists && fi.Length > previewThresholdBytes)
            {
                var result = MessageBox.Show(
                    this,
                    $"ファイルサイズが大きいです: {fi.Length / (1024 * 1024)} MB\n\n先頭 {previewBytes / (1024 * 1024)} MB だけをプレビュー（読み取り専用）で開きますか？",
                    "Large file",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);

                if (result != MessageBoxResult.Yes) return;

                var preview = TextFileService.ReadPreviewTextAuto(fullPath, previewBytes);
                text = preview.text;
                encoding = preview.encoding;
                hasBom = preview.hasBom;
                newlineKind = preview.newlineKind;
                isTruncated = preview.truncated;
                isReadOnly = true;
            }
            else
            {
                var r = TextFileService.ReadAllTextAuto(fullPath);
                text = r.text;
                encoding = r.encoding;
                hasBom = r.hasBom;
                newlineKind = r.newlineKind;
            }

            var doc = new EditorDocument
            {
                FilePath = fullPath,
                Encoding = encoding,
                WriteBom = encoding is UTF8Encoding && hasBom,
                NewlineKind = newlineKind,
                IsDirty = false,
                IsReadOnly = isReadOnly,
                IsTruncated = isTruncated,
            };

            var view = CreateEditorView();
            view.SetTextWithoutDirtyingUndo(text);
            view.EditorTextBox.IsReadOnly = doc.IsReadOnly;

            var tab = CreateTab(doc, view);
            DocumentsTabControl.Items.Add(tab);
            DocumentsTabControl.SelectedItem = tab;

            AddRecentFile(fullPath);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Open failed", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void SaveDocument()
    {
        var doc = GetActiveDocument();
        if (doc == null) return;

        if (string.IsNullOrWhiteSpace(doc.FilePath))
        {
            SaveDocumentAs();
            return;
        }

        WriteActiveDocumentTo(doc.FilePath);
    }

    private void SaveDocumentAs()
    {
        var doc = GetActiveDocument();
        if (doc == null) return;

        var dlg = new SaveFileDialog
        {
            FileName = string.IsNullOrWhiteSpace(doc.FilePath) ? "無題.txt" : Path.GetFileName(doc.FilePath),
            Filter = "Text files|*.txt|All files|*.*",
        };

        if (dlg.ShowDialog(this) != true) return;

        var fullPath = Path.GetFullPath(dlg.FileName);
        if (WriteActiveDocumentTo(fullPath))
        {
            doc.FilePath = fullPath;
            AddRecentFile(fullPath);
        }
    }

    private bool WriteActiveDocumentTo(string fullPath)
    {
        var doc = GetActiveDocument();
        var view = GetActiveEditorView();
        if (doc == null || view == null) return false;

        try
        {
            BackupService.BackupIfNeeded(App.Settings, fullPath);
            TextFileService.WriteAllText(fullPath, view.EditorTextBox.Text ?? "", doc.Encoding, doc.WriteBom, doc.NewlineKind);
            doc.IsDirty = false;
            UpdateWindowTitle();
            UpdateStatusBar();
            return true;
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Save failed", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    private EditorView CreateEditorView()
    {
        var view = new EditorView
        {
            WordWrap = _wordWrap,
            ShowLineNumbers = _showLineNumbers,
        };
        view.SetZoomFactor(_zoomFactor);

        view.EditorTextBox.SelectionChanged += (_, _) => UpdateStatusBar();
        view.EditorTextBox.GotKeyboardFocus += (_, _) => UpdateStatusBar();

        return view;
    }

    private TabItem CreateTab(EditorDocument doc, EditorView view)
    {
        var tab = new TabItem
        {
            Content = view,
            Tag = doc,
            Header = doc.DisplayName,
            ToolTip = doc.FilePath ?? "無題",
        };

        view.EditorTextBox.TextChanged += (_, _) =>
        {
            if (doc.IsReadOnly) return;
            if (!doc.IsDirty) doc.IsDirty = true;
            UpdateWindowTitle();
            UpdateStatusBar();
        };

        doc.PropertyChanged += (_, args) =>
        {
            if (args.PropertyName is nameof(EditorDocument.DisplayName))
            {
                tab.Header = doc.DisplayName;
            }

            if (args.PropertyName is nameof(EditorDocument.FilePath))
            {
                tab.ToolTip = doc.FilePath ?? "無題";
                UpdateWindowTitle();
            }

            UpdateStatusBar();
        };

        return tab;
    }

    private TabItem? FindTabByPath(string fullPath)
    {
        foreach (var tab in DocumentsTabControl.Items.OfType<TabItem>())
        {
            if (tab.Tag is not EditorDocument doc) continue;
            if (string.IsNullOrWhiteSpace(doc.FilePath)) continue;
            if (string.Equals(Path.GetFullPath(doc.FilePath), fullPath, StringComparison.OrdinalIgnoreCase))
            {
                return tab;
            }
        }

        return null;
    }

    private EditorDocument? GetActiveDocument()
        => (DocumentsTabControl.SelectedItem as TabItem)?.Tag as EditorDocument;

    private EditorView? GetActiveEditorView()
        => (DocumentsTabControl.SelectedItem as TabItem)?.Content as EditorView;

    private void UpdateWindowTitle()
    {
        var doc = GetActiveDocument();
        var name = doc?.DisplayName ?? "SakuraLikeEditor";
        Title = $"SakuraLikeEditor - {name}";
    }

    private void UpdateStatusBar()
    {
        var doc = GetActiveDocument();
        var view = GetActiveEditorView();

        if (doc == null || view == null)
        {
            StatusCaretText.Text = "Ln 1, Col 1";
            StatusEncodingText.Text = "UTF-8";
            StatusNewlineText.Text = "CRLF";
            StatusZoomText.Text = $"{(int)Math.Round(_zoomFactor * 100)}%";
            StatusBookmarkText.Text = "";
            StatusAutosaveText.Text = "";
            return;
        }

        var caretIndex = view.EditorTextBox.CaretIndex;
        var lineIndex = view.EditorTextBox.GetLineIndexFromCharacterIndex(caretIndex);
        var lineStart = view.EditorTextBox.GetCharacterIndexFromLineIndex(lineIndex);
        var col = caretIndex - lineStart + 1;
        var line = lineIndex + 1;

        StatusCaretText.Text = $"Ln {line}, Col {col}";
        StatusEncodingText.Text = FormatEncoding(doc.Encoding, doc.WriteBom);
        StatusNewlineText.Text = doc.NewlineKind switch
        {
            NewlineKind.CrLf => "CRLF",
            NewlineKind.Lf => "LF",
            NewlineKind.Cr => "CR",
            _ => "CRLF",
        };
        StatusZoomText.Text = $"{(int)Math.Round(_zoomFactor * 100)}%";
        StatusBookmarkText.Text = doc.BookmarkedLines.Count > 0 ? $"BM {doc.BookmarkedLines.Count}" : "";

        UpdateWindowTitle();
    }

    private static string FormatEncoding(Encoding encoding, bool writeBom)
    {
        if (encoding is UTF8Encoding) return writeBom ? "UTF-8 BOM" : "UTF-8";
        if (encoding.CodePage == 932) return "Shift-JIS";
        if (encoding.CodePage == 51932) return "EUC-JP";
        if (encoding.CodePage == Encoding.Unicode.CodePage) return "UTF-16 LE";
        if (encoding is UTF32Encoding) return "UTF-32 LE";
        return encoding.WebName;
    }

    private void ConfigureAutosaveTimer()
    {
        _autosaveTimer.Stop();

        if (!App.Settings.AutosaveEnabled)
        {
            StatusAutosaveText.Text = "";
            return;
        }

        var seconds = Math.Clamp(App.Settings.AutosaveIntervalSeconds, 10, 3600);
        _autosaveTimer.Interval = TimeSpan.FromSeconds(seconds);
        _autosaveTimer.Tick -= AutosaveTimer_Tick;
        _autosaveTimer.Tick += AutosaveTimer_Tick;
        _autosaveTimer.Start();
    }

    private void AutosaveTimer_Tick(object? sender, EventArgs e)
    {
        if (!App.Settings.AutosaveEnabled) return;

        var savedAny = false;
        foreach (var tab in DocumentsTabControl.Items.OfType<TabItem>())
        {
            if (tab.Tag is not EditorDocument doc) continue;
            if (!doc.IsDirty) continue;
            if (string.IsNullOrWhiteSpace(doc.FilePath)) continue;
            if (tab.Content is not EditorView view) continue;

            try
            {
                var dir = Path.Combine(SettingsService.GetAppDataDir(), "autosave");
                Directory.CreateDirectory(dir);

                var safeName = Path.GetFileName(doc.FilePath);
                var key = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(doc.FilePath))).Substring(0, 12);
                var autosavePath = Path.Combine(dir, $"{safeName}.{key}.autosave");

                TextFileService.WriteAllText(autosavePath, view.EditorTextBox.Text ?? "", doc.Encoding, doc.WriteBom, doc.NewlineKind);
                savedAny = true;
            }
            catch
            {
                // ignore autosave failures
            }
        }

        StatusAutosaveText.Text = savedAny ? $"Autosaved {DateTime.Now:HH:mm:ss}" : "";
    }

    private void AddRecentFile(string fullPath)
    {
        var list = App.Settings.RecentFiles;
        list.RemoveAll(p => string.Equals(p, fullPath, StringComparison.OrdinalIgnoreCase));
        list.Insert(0, fullPath);
        if (list.Count > MaxRecentFiles)
        {
            list.RemoveRange(MaxRecentFiles, list.Count - MaxRecentFiles);
        }
    }

    private void RecentFilesMenuItem_SubmenuOpened(object sender, RoutedEventArgs e)
    {
        RecentFilesMenuItem.Items.Clear();

        var list = App.Settings.RecentFiles.Where(p => !string.IsNullOrWhiteSpace(p)).ToList();
        if (list.Count == 0)
        {
            RecentFilesMenuItem.Items.Add(new MenuItem { Header = "(Empty)", IsEnabled = false });
            return;
        }

        for (var i = 0; i < list.Count; i++)
        {
            var path = list[i];
            var header = $"{i + 1}: {System.IO.Path.GetFileName(path)}";
            var mi = new MenuItem { Header = header, ToolTip = path };
            mi.Click += (_, _) =>
            {
                if (File.Exists(path))
                {
                    OpenDocumentPath(path);
                }
                else
                {
                    MessageBox.Show(this, "File not found.", "Recent Files", MessageBoxButton.OK, MessageBoxImage.Information);
                }
            };
            RecentFilesMenuItem.Items.Add(mi);
        }

        RecentFilesMenuItem.Items.Add(new Separator());
        var clear = new MenuItem { Header = "Clear Recent Files" };
        clear.Click += (_, _) =>
        {
            App.Settings.RecentFiles.Clear();
            RecentFilesMenuItem.Items.Clear();
        };
        RecentFilesMenuItem.Items.Add(clear);
    }

    private void Window_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }

    private void Window_Drop(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(DataFormats.FileDrop)) return;
        if (e.Data.GetData(DataFormats.FileDrop) is not string[] paths) return;

        foreach (var p in paths)
        {
            try
            {
                var fullPath = Path.GetFullPath(p);
                if (File.Exists(fullPath))
                {
                    OpenDocumentPath(fullPath);
                }
            }
            catch
            {
                // ignore
            }
        }
    }

    private void GoToLine()
    {
        var view = GetActiveEditorView();
        if (view == null) return;

        var caretIndex = view.EditorTextBox.CaretIndex;
        var currentLineIndex = view.EditorTextBox.GetLineIndexFromCharacterIndex(caretIndex);
        var currentLine = currentLineIndex + 1;
        var maxLine = Math.Max(1, view.EditorTextBox.LineCount);

        var dlg = new GoToLineWindow(currentLine, maxLine) { Owner = this };
        if (dlg.ShowDialog() != true) return;
        if (dlg.LineNumber == null) return;

        var line = Math.Clamp(dlg.LineNumber.Value, 1, maxLine) - 1;
        var charIndex = view.EditorTextBox.GetCharacterIndexFromLineIndex(line);
        view.EditorTextBox.Focus();
        view.EditorTextBox.CaretIndex = charIndex;
        view.EditorTextBox.Select(charIndex, 0);
        view.EditorTextBox.ScrollToLine(line);
        UpdateStatusBar();
    }

    private void ToggleBookmark()
    {
        var doc = GetActiveDocument();
        var view = GetActiveEditorView();
        if (doc == null || view == null) return;

        var line = view.EditorTextBox.GetLineIndexFromCharacterIndex(view.EditorTextBox.CaretIndex) + 1;
        if (doc.BookmarkedLines.Contains(line))
        {
            doc.BookmarkedLines.Remove(line);
        }
        else
        {
            doc.BookmarkedLines.Add(line);
        }

        UpdateStatusBar();
    }

    private void GoToNextBookmark(bool isPrev)
    {
        var doc = GetActiveDocument();
        var view = GetActiveEditorView();
        if (doc == null || view == null) return;
        if (doc.BookmarkedLines.Count == 0) return;

        var currentLine = view.EditorTextBox.GetLineIndexFromCharacterIndex(view.EditorTextBox.CaretIndex) + 1;
        var ordered = doc.BookmarkedLines.OrderBy(x => x).ToList();

        int target;
        if (!isPrev)
        {
            target = ordered.FirstOrDefault(x => x > currentLine);
            if (target == 0) target = ordered[0];
        }
        else
        {
            target = ordered.LastOrDefault(x => x < currentLine);
            if (target == 0) target = ordered[^1];
        }

        var maxLine = Math.Max(1, view.EditorTextBox.LineCount);
        target = Math.Clamp(target, 1, maxLine);
        var lineIndex = target - 1;
        var charIndex = view.EditorTextBox.GetCharacterIndexFromLineIndex(lineIndex);
        view.EditorTextBox.Focus();
        view.EditorTextBox.CaretIndex = charIndex;
        view.EditorTextBox.Select(charIndex, 0);
        view.EditorTextBox.ScrollToLine(lineIndex);
        UpdateStatusBar();
    }

    private void ShowGrep()
    {
        var dlg = new GrepWindow(OpenFileAtLine)
        {
            Owner = this,
        };
        dlg.Show();
    }

    private void OpenFileAtLine(string filePath, int lineNumber)
    {
        OpenDocumentPath(Path.GetFullPath(filePath));

        var view = GetActiveEditorView();
        if (view == null) return;

        var maxLine = Math.Max(1, view.EditorTextBox.LineCount);
        var target = Math.Clamp(lineNumber, 1, maxLine);
        var lineIndex = target - 1;
        var charIndex = view.EditorTextBox.GetCharacterIndexFromLineIndex(lineIndex);
        var lineLength = view.EditorTextBox.GetLineLength(lineIndex);

        view.EditorTextBox.Focus();
        view.EditorTextBox.CaretIndex = charIndex;
        view.EditorTextBox.Select(charIndex, Math.Min(lineLength, 512));
        view.EditorTextBox.ScrollToLine(lineIndex);
        UpdateStatusBar();
    }

    private void ShowCsvTable()
    {
        var view = GetActiveEditorView();
        if (view == null) return;

        var dlg = new CsvTableWindow(
            getText: () => view.EditorTextBox.Text ?? "",
            setText: t => view.EditorTextBox.Text = t)
        {
            Owner = this,
        };
        dlg.Show();
    }

    private void ShowFindReplace(bool isReplace)
    {
        var view = GetActiveEditorView();
        if (view == null) return;

        _findReplaceWindow ??= new FindReplaceWindow
        {
            Owner = this,
        };

        _findReplaceWindow.SetTargetEditor(view.EditorTextBox);

        if (!string.IsNullOrEmpty(view.EditorTextBox.SelectedText))
        {
            _findReplaceWindow.SetFindText(view.EditorTextBox.SelectedText);
        }

        if (_findReplaceWindow.IsVisible)
        {
            _findReplaceWindow.Activate();
        }
        else
        {
            _findReplaceWindow.Show();
        }

        if (isReplace)
        {
            _findReplaceWindow.FocusReplaceBox();
        }
    }

    private void SyncFindReplaceTarget()
    {
        if (_findReplaceWindow == null) return;
        if (!_findReplaceWindow.IsVisible) return;

        var view = GetActiveEditorView();
        _findReplaceWindow.SetTargetEditor(view?.EditorTextBox);
    }

    private bool PromptSaveAllIfDirty()
    {
        foreach (var tab in DocumentsTabControl.Items.OfType<TabItem>())
        {
            if (tab.Tag is not EditorDocument doc) continue;
            if (!doc.IsDirty) continue;

            DocumentsTabControl.SelectedItem = tab;

            var name = string.IsNullOrWhiteSpace(doc.FilePath) ? "無題" : Path.GetFileName(doc.FilePath);
            var result = MessageBox.Show(
                this,
                $"{name} は保存されていません。保存しますか？",
                "SakuraLikeEditor",
                MessageBoxButton.YesNoCancel,
                MessageBoxImage.Warning);

            if (result == MessageBoxResult.Cancel) return false;
            if (result == MessageBoxResult.No) continue;

            SaveDocument();
            if (doc.IsDirty) return false;
        }

        return true;
    }
}
