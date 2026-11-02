# Opens C:\demo in Explorer (or reuses it) and moves it to the given rectangle. Usage: place-explorer.ps1 X Y W H
param([int]$X,[int]$Y,[int]$W,[int]$H)
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
$sh = New-Object -ComObject Shell.Application
function Find-Demo { foreach ($ew in $sh.Windows()) { if ($ew.LocationURL -like '*/demo' -or $ew.LocationURL -like '*/demo/') { return $ew } } }
$ew = Find-Demo
if (-not $ew) {
  Start-Process explorer.exe 'C:\demo'
  for ($i = 0; $i -lt 30 -and -not $ew; $i++) { Start-Sleep -Milliseconds 300; $ew = Find-Demo }
}
if (-not $ew) { throw 'Explorer window not found' }
[Win]::ShowWindow([IntPtr]$ew.HWND, 9) | Out-Null
[Win]::SetWindowPos([IntPtr]$ew.HWND, [IntPtr]::Zero, $X, $Y, $W, $H, 0x0044) | Out-Null
try { $ew.Document.CurrentViewMode = 4 } catch { }
"placed $($ew.HWND)"
