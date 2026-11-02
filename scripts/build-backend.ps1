# Freezes backend\backend.py into build\backend\backend.exe (PyInstaller onedir).
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

python -m pip install --upgrade pyinstaller -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }

python -m PyInstaller backend\backend.py `
    --noconfirm --onedir --console `
    --name backend `
    --distpath build `
    --workpath build\pyi-work `
    --specpath build `
    --paths backend
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller failed' }

Write-Host "Backend built: $root\build\backend\backend.exe"
