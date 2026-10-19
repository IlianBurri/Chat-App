# Installs Hallo for the current user on Windows (no administrator rights needed):
#
#   irm https://ilianburri.github.io/Chat-App/install.ps1 | iex
#
# Downloads the latest installer from GitHub Releases, checks its SHA-256 checksum, installs it silently
# to %LOCALAPPDATA%\Programs\Hallo and starts Hallo. INSTALL_BASE_URL overrides the download location.

$ErrorActionPreference = 'Stop'
# The progress bar makes Invoke-WebRequest many times slower in Windows PowerShell 5.1.
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$base = if ($env:INSTALL_BASE_URL) { $env:INSTALL_BASE_URL.TrimEnd('/') } else { 'https://github.com/IlianBurri/Chat-App/releases/latest/download' }
$file = 'Hallo-Setup.exe'
$de = (Get-Culture).TwoLetterISOLanguageName -eq 'de'
# Umlauts as characters: the script must stay ASCII, because `irm | iex` may not decode it as UTF-8.
$ae = [char]0xE4; $oe = [char]0xF6; $ue = [char]0xFC
function Say([string]$german, [string]$english) { Write-Host ($(if ($de) { $german } else { $english })) }
function Fail([string]$german, [string]$english) {
  Write-Host ($(if ($de) { $german } else { $english })) -ForegroundColor Red
  throw 'Installation failed'
}

if (-not [Environment]::Is64BitOperatingSystem) {
  Fail 'Hallo braucht ein 64-Bit-Windows.' 'Hallo needs 64-bit Windows.'
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("hallo-install-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Say "Lade Hallo herunter ($base) ..." "Downloading Hallo ($base)..."
  $setup = Join-Path $tmp $file
  Invoke-WebRequest -Uri "$base/$file" -OutFile $setup -UseBasicParsing
  Invoke-WebRequest -Uri "$base/SHA256SUMS.txt" -OutFile (Join-Path $tmp 'SHA256SUMS.txt') -UseBasicParsing

  $line = Get-Content (Join-Path $tmp 'SHA256SUMS.txt') | Where-Object { $_ -match "^([0-9a-fA-F]{64})\s+\*?$([regex]::Escape($file))$" } | Select-Object -First 1
  if (-not $line) { Fail "Keine Pr${ue}fsumme f${ue}r den Installer gefunden." 'No checksum found for the installer.' }
  $expected = $line.Substring(0, 64).ToLower()
  $actual = (Get-FileHash -Algorithm SHA256 -Path $setup).Hash.ToLower()
  if ($expected -ne $actual) { Fail "Die Pr${ue}fsumme stimmt nicht. Der Download ist besch${ae}digt oder wurde ver${ae}ndert." 'The checksum does not match. The download is damaged or was tampered with.' }
  Say "Pr${ue}fsumme in Ordnung." 'Checksum OK.'

  # Close a running Hallo, otherwise its files cannot be replaced.
  Get-Process -Name 'Hallo' -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }
  Start-Sleep -Seconds 2
  Get-Process -Name 'Hallo' -ErrorAction SilentlyContinue | Stop-Process -Force

  Say 'Installiere ...' 'Installing...'
  $process = Start-Process -FilePath $setup -ArgumentList '/S', '/currentuser' -PassThru -Wait
  if ($process.ExitCode -ne 0) { Fail "Der Installer ist mit Code $($process.ExitCode) beendet worden." "The installer exited with code $($process.ExitCode)." }

  $exe = Join-Path $env:LOCALAPPDATA 'Programs\Hallo\Hallo.exe'
  if (-not (Test-Path $exe)) { Fail 'Hallo wurde nicht gefunden.' 'Hallo was not found after installing.' }
  Say "Hallo ist installiert ($exe) und im Startmen${ue} zu finden. Hallo startet jetzt." "Hallo is installed ($exe) and in the Start menu. Starting Hallo now."
  Start-Process -FilePath $exe
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
