# Open the handheld preview as a borderless Edge app window.
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class HhWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int X, int Y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public static List<IntPtr> Visible() {
    var list = new List<IntPtr>();
    EnumWindows((h, l) => { if (IsWindowVisible(h)) list.Add(h); return true; }, IntPtr.Zero);
    return list;
  }
  public static string Title(IntPtr h) {
    var sb = new StringBuilder(512);
    GetWindowText(h, sb, sb.Capacity);
    return sb.ToString();
  }
}
"@

function Get-PortraitAhaWindows {
  $hits = @()
  foreach ($h in [HhWin]::Visible()) {
    $title = [HhWin]::Title($h)
    $r = New-Object HhWin+RECT
    [void][HhWin]::GetWindowRect($h, [ref]$r)
    $w = $r.Right - $r.Left
    $ht = $r.Bottom - $r.Top
    $isPortrait = ($w -gt 280 -and $w -le 620 -and $ht -ge $w)
    if ($title -match 'Aha' -and ($title -match 'handheld' -or $isPortrait)) { $hits += $h }
  }
  return $hits
}

function Set-Frameless([IntPtr]$hwnd) {
  $style = [HhWin]::GetWindowLong($hwnd, -16)
  $clear = 0x00C00000 -bor 0x00040000 -bor 0x00020000 -bor 0x00010000
  [void][HhWin]::SetWindowLong($hwnd, -16, ($style -band (-bnot $clear)))
  $r = New-Object HhWin+RECT
  [void][HhWin]::GetWindowRect($hwnd, [ref]$r)
  $flags = 0x0004 -bor 0x0020 -bor 0x0040
  [void][HhWin]::SetWindowPos($hwnd, [IntPtr]::Zero, $r.Left, $r.Top, 414, 736, $flags)
}

$pf86 = ${env:ProgramFiles(x86)}
$pf = $env:ProgramFiles
$edge = @(
  (Join-Path $pf86 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $pf 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edge) { throw 'Microsoft Edge not found.' }

foreach ($h in Get-PortraitAhaWindows) {
  [void][HhWin]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
}

Start-Sleep -Milliseconds 400

$before = @{}
foreach ($h in [HhWin]::Visible()) { $before[([string]$h)] = $true }

$appUrl = '--app=http://localhost:5177/?view=handheld'
Start-Process -FilePath $edge -ArgumentList $appUrl

$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  foreach ($h in [HhWin]::Visible()) {
    $title = [HhWin]::Title($h)
    $isNew = -not $before.ContainsKey(([string]$h))
    if ($isNew -and ($title -match 'Aha' -or $title -match 'localhost:5177' -or $title -match 'handheld')) {
      $hwnd = $h
      break
    }
  }
  if ($hwnd -ne [IntPtr]::Zero) { break }
}

if ($hwnd -eq [IntPtr]::Zero) { throw 'Handheld window did not appear.' }

Start-Sleep -Milliseconds 800
Set-Frameless $hwnd
Write-Output 'opened-frameless'
