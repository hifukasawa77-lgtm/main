using System.Windows.Input;

namespace SakuraLikeEditor;

public static class MainWindowCommands
{
    public static readonly RoutedUICommand NewDocument =
        new("New", nameof(NewDocument), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.N, ModifierKeys.Control) });

    public static readonly RoutedUICommand OpenDocument =
        new("Open", nameof(OpenDocument), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.O, ModifierKeys.Control) });

    public static readonly RoutedUICommand SaveDocument =
        new("Save", nameof(SaveDocument), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.S, ModifierKeys.Control) });

    public static readonly RoutedUICommand SaveDocumentAs =
        new("Save As", nameof(SaveDocumentAs), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.S, ModifierKeys.Control | ModifierKeys.Shift) });

    public static readonly RoutedUICommand ExitApp =
        new("Exit", nameof(ExitApp), typeof(MainWindowCommands));

    public static readonly RoutedUICommand Find =
        new("Find", nameof(Find), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.F, ModifierKeys.Control) });

    public static readonly RoutedUICommand Replace =
        new("Replace", nameof(Replace), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.H, ModifierKeys.Control) });

    public static readonly RoutedUICommand GoToLine =
        new("Go To Line", nameof(GoToLine), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.G, ModifierKeys.Control) });

    public static readonly RoutedUICommand Grep =
        new("Grep", nameof(Grep), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.F, ModifierKeys.Control | ModifierKeys.Shift) });

    public static readonly RoutedUICommand ToggleWordWrap =
        new("Toggle Word Wrap", nameof(ToggleWordWrap), typeof(MainWindowCommands));

    public static readonly RoutedUICommand ToggleLineNumbers =
        new("Toggle Line Numbers", nameof(ToggleLineNumbers), typeof(MainWindowCommands));

    public static readonly RoutedUICommand ZoomIn =
        new("Zoom In", nameof(ZoomIn), typeof(MainWindowCommands),
            new InputGestureCollection
            {
                new KeyGesture(Key.OemPlus, ModifierKeys.Control),
                new KeyGesture(Key.Add, ModifierKeys.Control),
            });

    public static readonly RoutedUICommand ZoomOut =
        new("Zoom Out", nameof(ZoomOut), typeof(MainWindowCommands),
            new InputGestureCollection
            {
                new KeyGesture(Key.OemMinus, ModifierKeys.Control),
                new KeyGesture(Key.Subtract, ModifierKeys.Control),
            });

    public static readonly RoutedUICommand ZoomReset =
        new("Zoom Reset", nameof(ZoomReset), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.D0, ModifierKeys.Control) });

    public static readonly RoutedUICommand ToggleBookmark =
        new("Toggle Bookmark", nameof(ToggleBookmark), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.F2, ModifierKeys.Control) });

    public static readonly RoutedUICommand NextBookmark =
        new("Next Bookmark", nameof(NextBookmark), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.F2) });

    public static readonly RoutedUICommand PrevBookmark =
        new("Previous Bookmark", nameof(PrevBookmark), typeof(MainWindowCommands),
            new InputGestureCollection { new KeyGesture(Key.F2, ModifierKeys.Shift) });

    public static readonly RoutedUICommand SetEncodingUtf8NoBom =
        new("Set UTF-8 (no BOM)", nameof(SetEncodingUtf8NoBom), typeof(MainWindowCommands));

    public static readonly RoutedUICommand SetEncodingUtf8Bom =
        new("Set UTF-8 (with BOM)", nameof(SetEncodingUtf8Bom), typeof(MainWindowCommands));

    public static readonly RoutedUICommand SetEncodingShiftJis =
        new("Set Shift-JIS", nameof(SetEncodingShiftJis), typeof(MainWindowCommands));

    public static readonly RoutedUICommand SetEncodingEucJp =
        new("Set EUC-JP", nameof(SetEncodingEucJp), typeof(MainWindowCommands));

    public static readonly RoutedUICommand SetEncodingUtf16Le =
        new("Set UTF-16 LE", nameof(SetEncodingUtf16Le), typeof(MainWindowCommands));

    public static readonly RoutedUICommand SetEncodingUtf32Le =
        new("Set UTF-32 LE", nameof(SetEncodingUtf32Le), typeof(MainWindowCommands));
}
