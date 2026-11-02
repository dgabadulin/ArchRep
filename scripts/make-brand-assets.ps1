<#
.SYNOPSIS
    Builds ISAR brand assets in frontend-v3/public from the designer package.

.DESCRIPTION
    -SourceDir  : designer folder (лого.svg/png, лого-бел.*, "фавикон\32 на 32.svg").
                  PNGs are copied, SVGs normalized: <style>/classes inlined into
                  fill/stroke, single brand color, square viewBox for the mark.
    Always      : renders the icon set from public/favicon.svg with GDI+
                  (favicon-16/32/48/192/512, favicon.png, favicon.ico, apple-touch-icon, logo-icon.png).
    -MasterLogo : high-res logo PNG -> logo-email.png (480 px wide) and og-isar-1200x630.png.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/make-brand-assets.ps1 `
        -SourceDir temp\logo\исар -MasterLogo temp\logo\исар\лого.png

.EXAMPLE
    # только иконки, из уже лежащего в public/favicon.svg
    powershell -ExecutionPolicy Bypass -File scripts/make-brand-assets.ps1

.NOTES
    Windows only (System.Drawing). Brand color of the designer package: #00ABA7.
#>
[CmdletBinding()]
param(
    [string]$SourceDir = '',
    [string]$OutDir = '',
    [string]$MasterLogo = '',
    [string]$BrandColor = '#00ABA7'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$inv = [System.Globalization.CultureInfo]::InvariantCulture

function Write-TextFile {
    param([string]$Path, [string]$Text)
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Format-Num {
    param([double]$Value)
    return $Value.ToString('0.###', $inv)
}

function Get-SvgClassStyles {
    param([string]$Raw)

    $map = @{}
    foreach ($m in [regex]::Matches($Raw, '\.(cls-\d+)\s*\{([^}]*)\}')) {
        $decl = $m.Groups[2].Value
        $fill = ''
        $stroke = ''
        $strokeWidth = ''

        $fm = [regex]::Match($decl, 'fill:\s*([^;]+);')
        if ($fm.Success) { $fill = $fm.Groups[1].Value.Trim() }
        $sm = [regex]::Match($decl, 'stroke:\s*([^;]+);')
        if ($sm.Success) { $stroke = $sm.Groups[1].Value.Trim() }
        $wm = [regex]::Match($decl, 'stroke-width:\s*([^;]+);')
        if ($wm.Success) { $strokeWidth = $wm.Groups[1].Value.Trim() }

        $map[$m.Groups[1].Value] = [pscustomobject]@{ Fill = $fill; Stroke = $stroke; StrokeWidth = $strokeWidth }
    }
    return $map
}

function Inline-SvgClasses {
    param([string]$Raw, $Styles, [string]$Color)

    foreach ($name in $Styles.Keys) {
        $style = $Styles[$name]
        $attrs = @()
        if ($style.Fill -eq 'none') {
            $attrs += 'fill="none"'
        } elseif ($style.Fill) {
            $attrs += ('fill="' + $Color + '"')
        }
        if ($style.Stroke -and $style.Stroke -ne 'none') {
            $attrs += ('stroke="' + $Color + '"')
            if ($style.StrokeWidth) {
                $attrs += ('stroke-width="' + ($style.StrokeWidth -replace 'px$', '') + '"')
            }
        }
        $Raw = $Raw.Replace(('class="' + $name + '"'), ($attrs -join ' '))
    }
    return $Raw
}

function Convert-BrandSvg {
    param([string]$InPath, [string]$OutPath, [string]$Color)

    $raw = Get-Content -Raw -Encoding UTF8 $InPath
    $styles = Get-SvgClassStyles -Raw $raw
    $raw = [regex]::Replace($raw, '(?s)<defs>.*?</defs>\s*', '')
    $raw = Inline-SvgClasses -Raw $raw -Styles $styles -Color $Color
    $raw = [regex]::Replace($raw, '\s+id="[^"]*"', '')
    $raw = [regex]::Replace($raw, '\s+data-name="[^"]*"', '')
    $raw = [regex]::Replace($raw, '(?s)<!--.*?-->', '')
    Write-TextFile -Path $OutPath -Text $raw.Trim()
}

function Convert-MarkSvg {
    param([string]$InPath, [string]$OutPath, [string]$Color, [double]$PaddingRatio = 0.0)

    $raw = Get-Content -Raw -Encoding UTF8 $InPath
    $styles = Get-SvgClassStyles -Raw $raw
    $raw = [regex]::Replace($raw, '(?s)<defs>.*?</defs>\s*', '')
    $raw = Inline-SvgClasses -Raw $raw -Styles $styles -Color $Color
    $raw = $raw -replace '<line ', '<line stroke-linecap="round" '

    $viewBox = [regex]::Match($raw, 'viewBox="([^"]+)"').Groups[1].Value
    $n = ($viewBox -split '[\s,]+') | Where-Object { $_ -ne '' } | ForEach-Object { [double]::Parse($_, $inv) }
    $width = $n[2]
    $height = $n[3]

    $side = [Math]::Max($width, $height) * (1.0 + 2.0 * $PaddingRatio)
    $dx = ($side - $width) / 2.0
    $dy = ($side - $height) / 2.0

    $body = [regex]::Match($raw, '(?s)<svg\b[^>]*>(.*)</svg>').Groups[1].Value
    $body = [regex]::Replace($body, '(?s)<!--.*?-->', '')
    $body = ($body -replace '\s+', ' ').Trim()

    $out = @(
        '<?xml version="1.0" encoding="UTF-8"?>',
        ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (Format-Num $side) + ' ' + (Format-Num $side) + '" role="img" aria-label="ИСАР">'),
        '  <title>ИСАР</title>',
        ('  <g transform="translate(' + (Format-Num $dx) + ' ' + (Format-Num $dy) + ')">' + $body + '</g>'),
        '</svg>'
    ) -join "`r`n"
    Write-TextFile -Path $OutPath -Text $out
}

function Get-Attr {
    param([string]$Tag, [string]$Name)
    $m = [regex]::Match($Tag, [regex]::Escape($Name) + '="([^"]+)"')
    if (-not $m.Success) { return 0.0 }
    return [double]::Parse($m.Groups[1].Value, $inv)
}

function Read-MarkGeometry {
    param([string]$Path)

    $raw = Get-Content -Raw -Encoding UTF8 $Path
    $m = [regex]::Match($raw, 'viewBox="([^"]+)"')
    if (-not $m.Success) { throw "viewBox not found in $Path" }
    $n = ($m.Groups[1].Value -split '[\s,]+') | Where-Object { $_ -ne '' } | ForEach-Object { [double]::Parse($_, $inv) }

    $color = [regex]::Match($raw, '#[0-9a-fA-F]{6}').Value
    if (-not $color) { $color = $BrandColor }

    $circles = @()
    foreach ($c in [regex]::Matches($raw, '<circle\b[^>]*>')) {
        $t = $c.Value
        $circles += [pscustomobject]@{ CX = (Get-Attr $t 'cx'); CY = (Get-Attr $t 'cy'); R = (Get-Attr $t 'r') }
    }

    $lines = @()
    foreach ($l in [regex]::Matches($raw, '<line\b[^>]*>')) {
        $t = $l.Value
        $lines += [pscustomobject]@{
            X1    = (Get-Attr $t 'x1')
            Y1    = (Get-Attr $t 'y1')
            X2    = (Get-Attr $t 'x2')
            Y2    = (Get-Attr $t 'y2')
            Width = (Get-Attr $t 'stroke-width')
        }
    }

    if (($circles.Count + $lines.Count) -eq 0) {
        throw "No <circle>/<line> shapes found in $Path - the mark must be a simple geometric SVG."
    }

    return [pscustomobject]@{
        Width   = $n[2]
        Height  = $n[3]
        Color   = $color
        Circles = $circles
        Lines   = $lines
    }
}

function New-MarkBitmap {
    param(
        $Geometry,
        [int]$Size,
        [double]$Padding = 0.0,
        [switch]$Opaque
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    if ($Opaque) {
        $g.Clear([System.Drawing.Color]::White)
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $inner = $Size * (1.0 - 2.0 * $Padding)
    $scale = $inner / [Math]::Max($Geometry.Width, $Geometry.Height)
    $ox = ($Size - $Geometry.Width * $scale) / 2.0
    $oy = ($Size - $Geometry.Height * $scale) / 2.0

    $color = [System.Drawing.ColorTranslator]::FromHtml($Geometry.Color)
    $brush = New-Object System.Drawing.SolidBrush($color)

    foreach ($line in $Geometry.Lines) {
        $pen = New-Object System.Drawing.Pen($color, [single]($line.Width * $scale))
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawLine(
            $pen,
            [single]($ox + $line.X1 * $scale), [single]($oy + $line.Y1 * $scale),
            [single]($ox + $line.X2 * $scale), [single]($oy + $line.Y2 * $scale)
        )
        $pen.Dispose()
    }

    foreach ($circle in $Geometry.Circles) {
        $diameter = 2.0 * $circle.R * $scale
        $g.FillEllipse(
            $brush,
            [single]($ox + ($circle.CX - $circle.R) * $scale),
            [single]($oy + ($circle.CY - $circle.R) * $scale),
            [single]$diameter,
            [single]$diameter
        )
    }

    $brush.Dispose()
    $g.Dispose()
    return $bmp
}

function Save-Png {
    param([System.Drawing.Bitmap]$Bitmap, [string]$Path)
    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-ScaledPng {
    param([string]$Source, [string]$Path, [int]$Width)

    $src = [System.Drawing.Image]::FromFile($Source)
    try {
        $height = [int][Math]::Round($src.Height * $Width / $src.Width)
        $dst = New-Object System.Drawing.Bitmap($Width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($dst)
        $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $Width, $height)))
        $g.Dispose()
        Save-Png -Bitmap $dst -Path $Path
        $dst.Dispose()
        return "$Width x $height"
    } finally {
        $src.Dispose()
    }
}

function New-OgImage {
    param([string]$LogoPath, [string]$Path, [int]$Width = 1200, [int]$Height = 630)

    $background = [System.Drawing.ColorTranslator]::FromHtml('#F0F2F5')
    $brand = [System.Drawing.ColorTranslator]::FromHtml($BrandColor)
    $textColor = [System.Drawing.ColorTranslator]::FromHtml('#1A1A2E')

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($background)

    $stripe = New-Object System.Drawing.SolidBrush($brand)
    $g.FillRectangle($stripe, 0, 0, $Width, 12)
    $g.FillRectangle($stripe, 0, $Height - 12, $Width, 12)

    $logo = [System.Drawing.Image]::FromFile($LogoPath)
    try {
        $logoWidth = 560
        $logoHeight = [int][Math]::Round($logo.Height * $logoWidth / $logo.Width)
        $logoX = [int](($Width - $logoWidth) / 2)
        $logoY = 150
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($logo, $logoX, $logoY, $logoWidth, $logoHeight)
    } finally {
        $logo.Dispose()
    }

    $font = New-Object System.Drawing.Font('Segoe UI', [single]38, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush($textColor)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, [single]($logoY + $logoHeight + 40), [single]$Width, [single]70)
    $g.DrawString('Корпоративная архитектура · метамодель TOGAF', $font, $textBrush, $rect, $format)

    $format.Dispose()
    $font.Dispose()
    $textBrush.Dispose()
    $stripe.Dispose()
    $g.Dispose()

    Save-Png -Bitmap $bmp -Path $Path
    $bmp.Dispose()
}

function Write-IcoFile {
    param(
        [string]$Path,
        [int[]]$Sizes,
        $Geometry,
        [double]$Padding = 0.0
    )

    $frames = New-Object System.Collections.Generic.List[byte[]]
    foreach ($size in $Sizes) {
        $bmp = New-MarkBitmap -Geometry $Geometry -Size $size -Padding $Padding
        $stream = New-Object System.IO.MemoryStream
        $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames.Add($stream.ToArray())
        $stream.Dispose()
        $bmp.Dispose()
    }

    $out = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter($out)
    $writer.Write([UInt16]0)                 # reserved
    $writer.Write([UInt16]1)                 # type: icon
    $writer.Write([UInt16]$Sizes.Count)

    $offset = 6 + 16 * $Sizes.Count
    for ($i = 0; $i -lt $Sizes.Count; $i++) {
        $size = $Sizes[$i]
        $dim = if ($size -ge 256) { 0 } else { $size }
        $writer.Write([byte]$dim)            # width
        $writer.Write([byte]$dim)            # height
        $writer.Write([byte]0)               # palette colors
        $writer.Write([byte]0)               # reserved
        $writer.Write([UInt16]1)             # color planes
        $writer.Write([UInt16]32)            # bits per pixel
        $writer.Write([UInt32]$frames[$i].Length)
        $writer.Write([UInt32]$offset)
        $offset += $frames[$i].Length
    }

    foreach ($frame in $frames) { $writer.Write($frame) }
    $writer.Flush()
    [System.IO.File]::WriteAllBytes($Path, $out.ToArray())
    $writer.Dispose()
    $out.Dispose()
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if (-not $OutDir) {
    $OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'frontend-v3\public'
}
if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
$OutDir = (Resolve-Path $OutDir).Path

if ($SourceDir) {
    $src = (Resolve-Path $SourceDir).Path

    Copy-Item (Join-Path $src '1 размер\лого.png') (Join-Path $OutDir 'logo.png') -Force
    Copy-Item (Join-Path $src '1 размер\лого-бел.png') (Join-Path $OutDir 'logo-white.png') -Force
    Convert-BrandSvg -InPath (Join-Path $src '1 размер\лого.svg') -OutPath (Join-Path $OutDir 'logo.svg') -Color $BrandColor
    Convert-BrandSvg -InPath (Join-Path $src '1 размер\лого-бел.svg') -OutPath (Join-Path $OutDir 'logo-white.svg') -Color '#FFFFFF'
    Convert-MarkSvg -InPath (Join-Path $src 'фавикон\32 на 32.svg') -OutPath (Join-Path $OutDir 'favicon.svg') -Color $BrandColor -PaddingRatio 0.0
    Convert-MarkSvg -InPath (Join-Path $src 'фавикон\32 на 32.svg') -OutPath (Join-Path $OutDir 'logo-icon.svg') -Color $BrandColor -PaddingRatio 0.06
    Write-Host 'SVG/PNG: скопированы и нормализованы из поставки дизайнера.'
}

$markPath = Join-Path $OutDir 'favicon.svg'
$geometry = Read-MarkGeometry -Path $markPath
Write-Host ("mark: viewBox {0} x {1}, линий {2}, окружностей {3}, цвет {4}" -f $geometry.Width, $geometry.Height, $geometry.Lines.Count, $geometry.Circles.Count, $geometry.Color)

foreach ($size in @(16, 32, 48, 192, 512)) {
    $bmp = New-MarkBitmap -Geometry $geometry -Size $size
    Save-Png -Bitmap $bmp -Path (Join-Path $OutDir ("favicon-{0}.png" -f $size))
    $bmp.Dispose()
}
Copy-Item (Join-Path $OutDir 'favicon-192.png') (Join-Path $OutDir 'favicon.png') -Force
Write-Host 'favicon-16/32/48/192/512.png + favicon.png (192)'

$icon = New-MarkBitmap -Geometry $geometry -Size 512
Save-Png -Bitmap $icon -Path (Join-Path $OutDir 'logo-icon.png')
$icon.Dispose()
Write-Host 'logo-icon.png (512)'

$touch = New-MarkBitmap -Geometry $geometry -Size 180 -Padding 0.10 -Opaque
Save-Png -Bitmap $touch -Path (Join-Path $OutDir 'apple-touch-icon.png')
$touch.Dispose()
Write-Host 'apple-touch-icon.png (180, непрозрачный)'

Write-IcoFile -Path (Join-Path $OutDir 'favicon.ico') -Sizes @(16, 24, 32, 48, 64, 128, 256) -Geometry $geometry
Write-Host 'favicon.ico (16/24/32/48/64/128/256)'

if ($MasterLogo) {
    $master = (Resolve-Path $MasterLogo).Path
    $emailSize = Save-ScaledPng -Source $master -Path (Join-Path $OutDir 'logo-email.png') -Width 480
    Write-Host ("logo-email.png ({0})" -f $emailSize)
    New-OgImage -LogoPath $master -Path (Join-Path $OutDir 'og-isar-1200x630.png')
    Write-Host 'og-isar-1200x630.png'
}

Write-Host ("Готово: {0}" -f $OutDir)
