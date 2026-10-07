param (
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,

    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [string]$DocName = "POS_Receipt"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $FilePath)) {
    Write-Error "File tidak ditemukan: $FilePath"
    exit 1
}

$csharpCode = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

namespace PosHardware {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    public class RawPrinter {
        [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes, string docName) {
            IntPtr hPrinter = IntPtr.Zero;
            DOCINFOA di = new DOCINFOA();
            di.pDocName = docName;
            di.pDataType = "RAW";

            if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
                int err = Marshal.GetLastWin32Error();
                throw new Exception("Gagal membuka printer '" + szPrinterName + "'. Win32 Error: " + err);
            }

            try {
                if (!StartDocPrinter(hPrinter, 1, di)) {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception("Gagal memulai dokumen print di spooler. Win32 Error: " + err);
                }

                if (!StartPagePrinter(hPrinter)) {
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception("Gagal memulai halaman print di spooler. Win32 Error: " + err);
                }

                int dwWritten = 0;
                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                try {
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    if (!success) {
                        int err = Marshal.GetLastWin32Error();
                        throw new Exception("Gagal menulis data bytes ke printer. Win32 Error: " + err);
                    }
                } finally {
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                }

                EndPagePrinter(hPrinter);
                EndDocPrinter(hPrinter);
                return true;
            } finally {
                ClosePrinter(hPrinter);
            }
        }
    }
}
"@

try {
    if (-not ([System.Management.Automation.PSTypeName]'PosHardware.RawPrinter').Type) {
        Add-Type -TypeDefinition $csharpCode
    }

    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $result = [PosHardware.RawPrinter]::SendBytesToPrinter($PrinterName, $bytes, $DocName)
    Write-Output "SUCCESS: $result"
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
