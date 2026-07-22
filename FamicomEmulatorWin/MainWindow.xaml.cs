using Microsoft.Win32;
using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace FamicomEmulatorWin;

public partial class MainWindow : Window
{
    private readonly MiniCpu6502 cpu = new();
    private readonly WriteableBitmap frame = new(256, 240, 96, 96, PixelFormats.Bgra32, null);

    public MainWindow()
    {
        InitializeComponent();
        ScreenImage.Source = frame;
        DrawDemoFrame("NO ROM");
        UpdateCpuStatus();
        AppendLog("Famicom Emulator Lab for Windows ready.");
    }

    private void OpenRomClick(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Title = "NES ROM / FDS disk を開く",
            Filter = "NES/FDS files (*.nes;*.fds)|*.nes;*.fds|All files (*.*)|*.*"
        };

        if (dialog.ShowDialog(this) != true)
        {
            return;
        }

        var bytes = File.ReadAllBytes(dialog.FileName);
        var info = RomAnalyzer.Analyze(bytes);
        LogBox.Clear();
        AppendLog($"File: {Path.GetFileName(dialog.FileName)} ({bytes.Length:N0} bytes)");
        foreach (var line in info.Lines)
        {
            AppendLog(line);
        }

        RomStatus.Text = info.Kind;
        FdsStatus.Text = info.IsFds ? $"{info.FdsSides} side(s)" : "対応設計あり";
        DrawDemoFrame(info.Kind);
    }

    private void ResetDemoClick(object sender, RoutedEventArgs e)
    {
        LogBox.Clear();
        TraceBox.Clear();
        cpu.Reset();
        RomStatus.Text = "未読込";
        FdsStatus.Text = "BIOS待ち";
        DrawDemoFrame("NO ROM");
        UpdateCpuStatus();
        AppendLog("Demo state reset.");
    }

    private void StepCpuClick(object sender, RoutedEventArgs e)
    {
        AppendTrace(cpu.Step());
        UpdateCpuStatus();
    }

    private void RunCpuClick(object sender, RoutedEventArgs e)
    {
        for (var i = 0; i < 60; i++)
        {
            AppendTrace(cpu.Step());
        }

        UpdateCpuStatus();
    }

    private void DrawDemoFrame(string title)
    {
        var pixels = new byte[256 * 240 * 4];
        for (var y = 0; y < 240; y++)
        {
            for (var x = 0; x < 256; x++)
            {
                var offset = (y * 256 + x) * 4;
                pixels[offset] = (byte)(38 + Math.Sin((x + y) / 18.0) * 32);
                pixels[offset + 1] = (byte)(18 + y / 4);
                pixels[offset + 2] = (byte)(8 + x / 3);
                pixels[offset + 3] = 255;
            }
        }

        frame.WritePixels(new Int32Rect(0, 0, 256, 240), pixels, 256 * 4, 0);
    }

    private void UpdateCpuStatus()
    {
        CpuStatus.Text = cpu.Halted ? "停止" : $"{cpu.Cycles} cycles";
    }

    private void AppendLog(string message)
    {
        LogBox.AppendText(message + Environment.NewLine);
        LogBox.ScrollToEnd();
    }

    private void AppendTrace(string message)
    {
        TraceBox.AppendText(message + Environment.NewLine);
        TraceBox.ScrollToEnd();
    }
}

internal sealed record RomInfo(string Kind, bool IsFds, int FdsSides, string[] Lines);

internal static class RomAnalyzer
{
    public static RomInfo Analyze(byte[] bytes)
    {
        if (bytes.Length >= 16 && bytes[0] == 0x4e && bytes[1] == 0x45 && bytes[2] == 0x53 && bytes[3] == 0x1a)
        {
            var prg = bytes[4] * 16;
            var chr = bytes[5] * 8;
            var mapper = (bytes[6] >> 4) | (bytes[7] & 0xf0);
            var nes2 = (bytes[7] & 0x0c) == 0x08;
            var mirroring = (bytes[6] & 1) == 1 ? "vertical" : "horizontal";
            return new RomInfo(
                nes2 ? "NES 2.0" : "iNES",
                false,
                0,
                new[]
                {
                    $"type: {(nes2 ? "NES 2.0" : "iNES")}",
                    $"PRG ROM: {prg} KiB",
                    $"CHR ROM: {chr} KiB",
                    $"mapper: {mapper}",
                    $"mirroring: {mirroring}",
                    $"battery: {((bytes[6] & 2) != 0)}",
                    $"trainer: {((bytes[6] & 4) != 0)}"
                });
        }

        var hasHeader = bytes.Length >= 16 && bytes.Take(4).SequenceEqual(new byte[] { 0x46, 0x44, 0x53, 0x1a });
        var body = bytes.Length - (hasHeader ? 16 : 0);
        var sides = Math.Max(1, (int)Math.Round(body / 65500.0));
        return new RomInfo(
            "Famicom Disk System",
            true,
            sides,
            new[]
            {
                "type: Famicom Disk System",
                $"header: {(hasHeader ? "FDS header" : "raw disk image")}",
                $"sides: {sides}",
                $"size: {bytes.Length:N0} bytes"
            });
    }
}

internal sealed class MiniCpu6502
{
    private readonly byte[] memory = new byte[65536];

    public MiniCpu6502()
    {
        Reset();
    }

    public byte A { get; private set; }
    public byte X { get; private set; }
    public byte Y { get; private set; }
    public byte P { get; private set; } = 0x24;
    public byte Sp { get; private set; } = 0xfd;
    public ushort Pc { get; private set; } = 0x8000;
    public int Cycles { get; private set; }
    public bool Halted { get; private set; }

    public void Reset()
    {
        Array.Clear(memory);
        var program = new byte[] { 0xA9, 0x01, 0xAA, 0xE8, 0x8D, 0x00, 0x02, 0xE8, 0x4C, 0x05, 0x80 };
        Array.Copy(program, 0, memory, 0x8000, program.Length);
        A = 0;
        X = 0;
        Y = 0;
        P = 0x24;
        Sp = 0xfd;
        Pc = 0x8000;
        Cycles = 0;
        Halted = false;
    }

    public string Step()
    {
        if (Halted)
        {
            return "CPU halted.";
        }

        var pc = Pc;
        var op = memory[Pc++];
        var text = op switch
        {
            0xA9 => LdaImmediate(),
            0xAA => Tax(),
            0xE8 => Inx(),
            0x8D => StaAbsolute(),
            0x4C => JmpAbsolute(),
            _ => Halt(op)
        };
        Cycles++;
        return $"0x{pc:X4}  0x{op:X2}  {text}   A:{A:X2} X:{X:X2} Y:{Y:X2} P:{P:X2} SP:{Sp:X2}";
    }

    private string LdaImmediate()
    {
        A = memory[Pc++];
        SetZeroNegative(A);
        return $"LDA #0x{A:X2}";
    }

    private string Tax()
    {
        X = A;
        SetZeroNegative(X);
        return "TAX";
    }

    private string Inx()
    {
        X++;
        SetZeroNegative(X);
        return "INX";
    }

    private string StaAbsolute()
    {
        var address = ReadWord();
        memory[address] = A;
        return $"STA 0x{address:X4}";
    }

    private string JmpAbsolute()
    {
        Pc = ReadWord();
        return $"JMP 0x{Pc:X4}";
    }

    private string Halt(byte op)
    {
        Halted = true;
        return $"未実装 opcode 0x{op:X2}";
    }

    private ushort ReadWord()
    {
        var low = memory[Pc++];
        var high = memory[Pc++];
        return (ushort)((high << 8) | low);
    }

    private void SetZeroNegative(byte value)
    {
        P = (byte)((P & ~0x82) | (value == 0 ? 0x02 : 0) | (value & 0x80));
    }
}
