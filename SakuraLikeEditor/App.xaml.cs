using System.Configuration;
using System.Data;
using System.IO;
using System.Text;
using System.Windows;
using SakuraLikeEditor.Models;
using SakuraLikeEditor.Services;

namespace SakuraLikeEditor;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    public static EditorSettings Settings { get; private set; } = new();

    protected override void OnStartup(StartupEventArgs e)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        var args = e.Args ?? Array.Empty<string>();
        SettingsService.PortableMode = args.Any(a => string.Equals(a, "--portable", StringComparison.OrdinalIgnoreCase))
                                       || File.Exists(Path.Combine(AppContext.BaseDirectory, "portable.mode"));

        Settings = SettingsService.Load();
        base.OnStartup(e);

        var window = new MainWindow();
        window.Show();

        var files = args.Where(a => !a.StartsWith("-", StringComparison.Ordinal)).ToArray();
        if (files.Length > 0)
        {
            window.OpenFilesFromCommandLine(files);
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        try
        {
            SettingsService.Save(Settings);
        }
        catch
        {
            // ignore
        }

        base.OnExit(e);
    }
}

