using System.Text.Json.Serialization;

namespace SakuraLikeEditor.Models;

public sealed class EditorSettings
{
    public bool AutosaveEnabled { get; set; } = true;
    public int AutosaveIntervalSeconds { get; set; } = 60;

    public bool BackupEnabled { get; set; } = true;
    public int BackupKeepCount { get; set; } = 10;
    public string BackupFolderName { get; set; } = ".sakura-backup";

    [JsonInclude]
    public List<string> FindHistory { get; private set; } = new();

    [JsonInclude]
    public List<string> RecentFiles { get; private set; } = new();
}
