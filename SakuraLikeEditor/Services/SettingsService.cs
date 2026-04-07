using System.IO;
using System.Text.Json;
using SakuraLikeEditor.Models;

namespace SakuraLikeEditor.Services;

public static class SettingsService
{
    public static bool PortableMode { get; set; }

    public static string GetAppDataDir()
    {
        if (PortableMode)
        {
            return Path.Combine(AppContext.BaseDirectory, "SakuraLikeEditorData");
        }

        var baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(baseDir, "SakuraLikeEditor");
    }

    public static string GetSettingsPath()
        => Path.Combine(GetAppDataDir(), "settings.json");

    public static EditorSettings Load()
    {
        try
        {
            var path = GetSettingsPath();
            if (!File.Exists(path)) return new EditorSettings();

            var json = File.ReadAllText(path);
            var settings = JsonSerializer.Deserialize<EditorSettings>(json);
            return settings ?? new EditorSettings();
        }
        catch
        {
            return new EditorSettings();
        }
    }

    public static void Save(EditorSettings settings)
    {
        var dir = GetAppDataDir();
        Directory.CreateDirectory(dir);

        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions
        {
            WriteIndented = true,
        });

        File.WriteAllText(GetSettingsPath(), json);
    }
}
