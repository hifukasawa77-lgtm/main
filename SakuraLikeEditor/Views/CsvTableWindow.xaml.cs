using System.Data;
using System.Windows;
using System.Windows.Controls;
using SakuraLikeEditor.Services;

namespace SakuraLikeEditor.Views;

public partial class CsvTableWindow : Window
{
    private readonly Func<string> _getText;
    private readonly Action<string> _setText;

    public CsvTableWindow(Func<string> getText, Action<string> setText)
    {
        InitializeComponent();
        _getText = getText;
        _setText = setText;
        Loaded += (_, _) => RefreshTable();

        CsvDataGrid.ContextMenu = BuildContextMenu();
    }

    private void Refresh_Click(object sender, RoutedEventArgs e)
        => RefreshTable();

    private void RefreshTable()
    {
        try
        {
            var delimiter = GetDelimiter();
            var text = _getText();
            var rows = CsvService.Parse(text, delimiter);

            var maxCols = rows.Count == 0 ? 0 : rows.Max(r => r.Count);
            var table = new DataTable();

            for (var c = 0; c < maxCols; c++)
            {
                table.Columns.Add(CsvService.ColumnName(c));
            }

            foreach (var row in rows)
            {
                var dr = table.NewRow();
                for (var c = 0; c < maxCols; c++)
                {
                    dr[c] = c < row.Count ? row[c] : "";
                }
                table.Rows.Add(dr);
            }

            CsvDataGrid.ItemsSource = table.DefaultView;
            StatusTextBlock.Text = $"Rows: {rows.Count}  Cols: {maxCols}";
            HintTextBlock.Text = "Right click: Copy/Delete selected column";
        }
        catch (Exception ex)
        {
            StatusTextBlock.Text = "Failed.";
            MessageBox.Show(this, ex.Message, "CSV Table", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private ContextMenu BuildContextMenu()
    {
        var menu = new ContextMenu();

        var copyCol = new MenuItem { Header = "Copy Column" };
        copyCol.Click += (_, _) => CopySelectedColumn();
        menu.Items.Add(copyCol);

        var delCol = new MenuItem { Header = "Delete Column" };
        delCol.Click += (_, _) => DeleteSelectedColumn();
        menu.Items.Add(delCol);

        return menu;
    }

    private int? GetSelectedColumnIndex()
    {
        if (CsvDataGrid.CurrentCell.Column == null) return null;
        return CsvDataGrid.CurrentCell.Column.DisplayIndex;
    }

    private void CopySelectedColumn()
    {
        var colIndex = GetSelectedColumnIndex();
        if (colIndex == null) return;

        var delimiter = GetDelimiter();
        var rows = CsvService.Parse(_getText(), delimiter);

        var lines = rows.Select(r => colIndex.Value < r.Count ? r[colIndex.Value] : "");
        Clipboard.SetText(string.Join(Environment.NewLine, lines));
        StatusTextBlock.Text = $"Copied column {CsvService.ColumnName(colIndex.Value)}";
    }

    private void DeleteSelectedColumn()
    {
        var colIndex = GetSelectedColumnIndex();
        if (colIndex == null) return;

        var result = MessageBox.Show(
            this,
            $"Delete column {CsvService.ColumnName(colIndex.Value)} ?",
            "CSV Table",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning);
        if (result != MessageBoxResult.Yes) return;

        var delimiter = GetDelimiter();
        var rows = CsvService.Parse(_getText(), delimiter);
        foreach (var r in rows)
        {
            if (colIndex.Value < r.Count)
            {
                r.RemoveAt(colIndex.Value);
            }
        }

        _setText(CsvService.Serialize(rows, delimiter));
        RefreshTable();
        StatusTextBlock.Text = $"Deleted column {CsvService.ColumnName(colIndex.Value)}";
    }

    private char GetDelimiter()
        => DelimiterComboBox.SelectedIndex switch
        {
            1 => '\t',
            2 => ';',
            _ => ',',
        };
}

