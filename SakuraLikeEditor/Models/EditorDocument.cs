using System.ComponentModel;
using System.IO;
using System.Runtime.CompilerServices;
using System.Text;

namespace SakuraLikeEditor.Models;

public enum NewlineKind
{
    CrLf,
    Lf,
    Cr,
}

public sealed class EditorDocument : INotifyPropertyChanged
{
    private string? _filePath;
    private bool _isDirty;
    private Encoding _encoding = new UTF8Encoding(false);
    private bool _writeBom;
    private NewlineKind _newlineKind = NewlineKind.CrLf;
    private bool _isReadOnly;
    private bool _isTruncated;

    public event PropertyChangedEventHandler? PropertyChanged;

    public HashSet<int> BookmarkedLines { get; } = new();

    public string? FilePath
    {
        get => _filePath;
        set
        {
            if (_filePath == value) return;
            _filePath = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DisplayName));
        }
    }

    public string DisplayName
    {
        get
        {
            var name = string.IsNullOrWhiteSpace(FilePath) ? "無題" : Path.GetFileName(FilePath);
            if (IsDirty) name = $"{name} *";
            if (IsReadOnly) name = $"{name} [RO]";
            if (IsTruncated) name = $"{name} [Preview]";
            return name;
        }
    }

    public bool IsDirty
    {
        get => _isDirty;
        set
        {
            if (_isDirty == value) return;
            _isDirty = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DisplayName));
        }
    }

    public Encoding Encoding
    {
        get => _encoding;
        set
        {
            if (_encoding.Equals(value)) return;
            _encoding = value;
            OnPropertyChanged();
        }
    }

    public bool WriteBom
    {
        get => _writeBom;
        set
        {
            if (_writeBom == value) return;
            _writeBom = value;
            OnPropertyChanged();
        }
    }

    public NewlineKind NewlineKind
    {
        get => _newlineKind;
        set
        {
            if (_newlineKind == value) return;
            _newlineKind = value;
            OnPropertyChanged();
        }
    }

    public bool IsReadOnly
    {
        get => _isReadOnly;
        set
        {
            if (_isReadOnly == value) return;
            _isReadOnly = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DisplayName));
        }
    }

    public bool IsTruncated
    {
        get => _isTruncated;
        set
        {
            if (_isTruncated == value) return;
            _isTruncated = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(DisplayName));
        }
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
