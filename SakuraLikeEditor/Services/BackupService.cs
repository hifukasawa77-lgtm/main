using System.IO;
using SakuraLikeEditor.Models;

namespace SakuraLikeEditor.Services;

public static class BackupService
{
    public static void BackupIfNeeded(EditorSettings settings, string filePath)
    {
        if (!settings.BackupEnabled) return;
        if (settings.BackupKeepCount <= 0) return;
        if (!File.Exists(filePath)) return;

        var dir = Path.GetDirectoryName(filePath);
        if (string.IsNullOrWhiteSpace(dir)) return;

        var backupDir = Path.Combine(dir, settings.BackupFolderName);
        Directory.CreateDirectory(backupDir);

        var name = Path.GetFileName(filePath);
        var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        var backupName = $"{name}.{stamp}.bak";
        var dest = Path.Combine(backupDir, backupName);

        File.Copy(filePath, dest, overwrite: false);
        TrimOldBackups(backupDir, name, settings.BackupKeepCount);
    }

    private static void TrimOldBackups(string backupDir, string originalName, int keepCount)
    {
        try
        {
            var prefix = originalName + ".";
            var files = new DirectoryInfo(backupDir)
                .EnumerateFiles($"{originalName}.*.bak", SearchOption.TopDirectoryOnly)
                .Where(f => f.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(f => f.CreationTimeUtc)
                .ToList();

            foreach (var f in files.Skip(keepCount))
            {
                try { f.Delete(); } catch { }
            }
        }
        catch
        {
            // ignore backup cleanup failures
        }
    }
}
