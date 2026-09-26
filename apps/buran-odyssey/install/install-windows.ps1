# «Буран-М: Одиссея» — установка на Windows 10/11.
#
# В PowerShell:
#   irm https://raw.githubusercontent.com/NeoBlau/NeoShop-/claude/affectionate-gauss-hor809/apps/buran-odyssey/install/install-windows.ps1 | iex
#
# или с уже скачанным ZIP:
#   powershell -ExecutionPolicy Bypass -File install-windows.ps1 -Zip "$HOME\Downloads\NeoShop-....zip"
#
# Ставит Node.js LTS (если нет), кладёт игру в %USERPROFILE%\Games\BuranM,
# скачивает текстуры, создаёт ярлык на рабочем столе и запускает игру.
param([string]$Zip = '')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # иначе Invoke-WebRequest очень медленный
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = 'NeoBlau/NeoShop-'
$Branch = if ($env:BURAN_BRANCH) { $env:BURAN_BRANCH } else { 'claude/affectionate-gauss-hor809' }
$Dest = if ($env:BURAN_DIR) { $env:BURAN_DIR } else { Join-Path $env:USERPROFILE 'Games\BuranM' }

function Say($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Node-Ok {
  $n = Get-Command node -ErrorAction SilentlyContinue
  if (-not $n) { return $false }
  return [int]((& node -p "process.versions.node.split('.')[0]")) -ge 18
}

# 1. Node.js
if (-not (Node-Ok)) {
  Say 'Устанавливаю Node.js LTS'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  } else {
    $base = 'https://nodejs.org/dist/latest-v22.x'
    $line = ((Invoke-WebRequest "$base/SHASUMS256.txt" -UseBasicParsing).Content -split "`n") | Where-Object { $_ -match 'x64\.msi$' } | Select-Object -First 1
    $sum, $file = $line -split '\s+'
    $msi = Join-Path $env:TEMP $file
    Invoke-WebRequest "$base/$file" -OutFile $msi -UseBasicParsing
    if ((Get-FileHash $msi -Algorithm SHA256).Hash -ne $sum.ToUpper()) { throw 'Контрольная сумма Node.js не совпала' }
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive" -Wait
    Remove-Item $msi
  }
  Refresh-Path
  if (-not (Node-Ok)) { throw 'Node.js не установился. Установите вручную с https://nodejs.org и запустите скрипт снова.' }
}
Write-Host "Node.js $(node -v)"

# 2. Игра
$tmp = Join-Path $env:TEMP ('buran-' + [guid]::NewGuid())
New-Item -ItemType Directory $tmp | Out-Null
try {
  $zipPath = Join-Path $tmp 'buran.zip'
  if ($Zip) {
    Copy-Item $Zip $zipPath
  } else {
    Say 'Скачиваю игру из GitHub'
    try {
      Invoke-WebRequest "https://codeload.github.com/$Repo/zip/refs/heads/$Branch" -OutFile $zipPath -UseBasicParsing
    } catch {
      throw 'Не удалось скачать. Если репозиторий приватный: скачайте ZIP в браузере (Code -> Download ZIP) и запустите скрипт с параметром -Zip путь\к\файлу.zip'
    }
  }
  Expand-Archive $zipPath $tmp
  $src = Get-ChildItem $tmp -Directory | ForEach-Object { Join-Path $_.FullName 'apps\buran-odyssey' } | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $src) { throw 'В архиве нет apps\buran-odyssey' }

  # Скачанные текстуры переживают обновление.
  foreach ($keep in 'assets', 'vendor') {
    if (Test-Path "$Dest\$keep") { Move-Item "$Dest\$keep" "$tmp\keep-$keep" }
  }
  if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
  New-Item -ItemType Directory (Split-Path $Dest) -Force | Out-Null
  Copy-Item $src $Dest -Recurse
  foreach ($keep in 'assets', 'vendor') {
    if (Test-Path "$tmp\keep-$keep") {
      if (Test-Path "$Dest\$keep") { Remove-Item "$Dest\$keep" -Recurse -Force }
      Move-Item "$tmp\keep-$keep" "$Dest\$keep"
    }
  }
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# 3. Текстуры для офлайна
Set-Location $Dest
if (-not (Test-Path 'assets\manifest.json')) {
  Say 'Скачиваю текстуры (~30 МБ)'
  node tools\fetch-assets.mjs
  if ($LASTEXITCODE -ne 0) { Write-Host 'Не получилось — игра будет брать текстуры из интернета.' }
}

# 4. Ярлык на рабочем столе
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Буран-М.lnk'))
$lnk.TargetPath = Join-Path $Dest 'start-windows.bat'
$lnk.WorkingDirectory = $Dest
$lnk.Description = 'Буран-М: Одиссея'
$lnk.Save()

Say "Готово. Игра: $Dest, ярлык «Буран-М» на рабочем столе"
Start-Process (Join-Path $Dest 'start-windows.bat') -WorkingDirectory $Dest
