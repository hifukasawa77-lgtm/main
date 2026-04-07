using System.Globalization;
using System.Windows;

namespace SakuraLikeEditor.Views;

public partial class GoToLineWindow : Window
{
    public int? LineNumber { get; private set; }

    public GoToLineWindow(int currentLine, int maxLine)
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            LineTextBox.Text = currentLine.ToString(CultureInfo.InvariantCulture);
            LineTextBox.SelectAll();
            LineTextBox.Focus();
        };

        Title = $"Go To Line (1 - {maxLine})";
    }

    private void Ok_Click(object sender, RoutedEventArgs e)
    {
        if (int.TryParse(LineTextBox.Text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var line))
        {
            LineNumber = line;
            DialogResult = true;
            return;
        }

        MessageBox.Show(this, "Invalid line number.", "Go To Line", MessageBoxButton.OK, MessageBoxImage.Information);
    }
}

