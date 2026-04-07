using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace SakuraLikeEditor.Views;

public partial class EditorView : UserControl
{
    private ScrollViewer? _editorScrollViewer;
    private bool _suppressLineNumberUpdate;

    public static readonly DependencyProperty ShowLineNumbersProperty =
        DependencyProperty.Register(
            nameof(ShowLineNumbers),
            typeof(bool),
            typeof(EditorView),
            new PropertyMetadata(true, (_, _) => { }));

    public static readonly DependencyProperty WordWrapProperty =
        DependencyProperty.Register(
            nameof(WordWrap),
            typeof(bool),
            typeof(EditorView),
            new PropertyMetadata(true, (_, _) => { }));

    public EditorView()
    {
        InitializeComponent();

        Loaded += (_, _) =>
        {
            _editorScrollViewer = FindDescendantScrollViewer(EditorTextBox);
            if (_editorScrollViewer != null)
            {
                _editorScrollViewer.ScrollChanged += (_, _) => SyncLineNumberScroll();
            }

            ApplyOptions();
            UpdateLineNumbers();
        };

        EditorTextBox.TextChanged += (_, _) =>
        {
            if (_suppressLineNumberUpdate) return;
            UpdateLineNumbers();
        };

        EditorTextBox.SizeChanged += (_, _) => UpdateLineNumbers();
    }

    public bool ShowLineNumbers
    {
        get => (bool)GetValue(ShowLineNumbersProperty);
        set
        {
            SetValue(ShowLineNumbersProperty, value);
            ApplyOptions();
        }
    }

    public bool WordWrap
    {
        get => (bool)GetValue(WordWrapProperty);
        set
        {
            SetValue(WordWrapProperty, value);
            ApplyOptions();
        }
    }

    public double ZoomFactor { get; private set; } = 1.0;

    public void SetZoomFactor(double zoomFactor)
    {
        ZoomFactor = Math.Clamp(zoomFactor, 0.25, 4.0);
        var baseSize = 14.0;
        var fontSize = baseSize * ZoomFactor;
        EditorTextBox.FontSize = fontSize;
        LineNumbersTextBlock.FontSize = fontSize;
        UpdateLineNumbers();
    }

    public void SetTextWithoutDirtyingUndo(string text)
    {
        _suppressLineNumberUpdate = true;
        try
        {
            EditorTextBox.Text = text;
            EditorTextBox.CaretIndex = 0;
            EditorTextBox.ScrollToHome();
            // Reset undo stack after programmatic load.
            EditorTextBox.IsUndoEnabled = false;
            EditorTextBox.IsUndoEnabled = true;
        }
        finally
        {
            _suppressLineNumberUpdate = false;
            UpdateLineNumbers();
        }
    }

    private void ApplyOptions()
    {
        LineNumbersBorder.Visibility = ShowLineNumbers ? Visibility.Visible : Visibility.Collapsed;
        LineNumbersColumn.Width = ShowLineNumbers ? GridLength.Auto : new GridLength(0);
        EditorTextBox.TextWrapping = WordWrap ? TextWrapping.Wrap : TextWrapping.NoWrap;

        if (!WordWrap)
        {
            EditorTextBox.HorizontalScrollBarVisibility = ScrollBarVisibility.Auto;
        }
    }

    private void SyncLineNumberScroll()
    {
        if (_editorScrollViewer == null) return;
        LineNumbersTransform.Y = -_editorScrollViewer.VerticalOffset;
    }

    private void UpdateLineNumbers()
    {
        if (!ShowLineNumbers) return;

        var lineCount = Math.Max(1, EditorTextBox.LineCount);
        var digits = lineCount.ToString().Length;

        // Keep the gutter wide enough for the current digits.
        var approxDigitWidth = EditorTextBox.FontSize * 0.62;
        LineNumbersTextBlock.MinWidth = Math.Max(36, (digits * approxDigitWidth) + 16);

        var sb = new StringBuilder(capacity: lineCount * (digits + 2));
        for (var i = 1; i <= lineCount; i++)
        {
            sb.Append(i.ToString().PadLeft(digits));
            if (i != lineCount) sb.Append("\r\n");
        }

        LineNumbersTextBlock.Text = sb.ToString();
        SyncLineNumberScroll();
    }

    private static ScrollViewer? FindDescendantScrollViewer(DependencyObject root)
    {
        if (root is ScrollViewer sv) return sv;

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            var result = FindDescendantScrollViewer(child);
            if (result != null) return result;
        }

        return null;
    }
}
