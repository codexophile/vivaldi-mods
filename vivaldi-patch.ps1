# Author: debiedowner (original batch script)
# PowerShell conversion
. "C:\mega\IDEs\powershell\#lib\functions.ps1"
# Make current directory work when run as administrator
RunAsAdmin
Set-Location -Path $PSScriptRoot

$installPath = "C:\Program Files\Vivaldi\Application\"
Write-Host "Searching at: $installPath"

$latestVersionFolder = Get-ChildItem -Path $installPath -Recurse -File |
Where-Object { $_.Name -eq "window.html" } |
Select-Object -ExpandProperty DirectoryName -First 1

if (-not $latestVersionFolder) {
  Write-Host "Couldn't find the latest version folder."
  Read-Host "Press Enter to exit"
  exit
}
else {
  Write-Host "Found latest version folder: '$latestVersionFolder'"
}

$windowHtmlPath = Join-Path -Path $latestVersionFolder -ChildPath "window.html"
$windowBakHtmlPath = Join-Path -Path $latestVersionFolder -ChildPath "window.bak.html"
$customJsPath = Join-Path -Path $latestVersionFolder -ChildPath "custom.js"

if (-not (Test-Path -Path $windowBakHtmlPath)) {
  Write-Host "Creating a backup of your original window.html file."
  Copy-Item -Path $windowHtmlPath -Destination $windowBakHtmlPath
}

Write-Host "Copying js files to custom.js"
Get-Content -Path *.js | Set-Content -Path $customJsPath

Write-Host "Patching window.html file"
$content = Get-Content -Path $windowBakHtmlPath |
Where-Object { $_ -notmatch "</body>" -and $_ -notmatch "</html>" }

$content += "    <script src=`"custom.js`"></script>"
$content += "  </body>"
$content += "</html>"

$content | Set-Content -Path $windowHtmlPath

Read-Host "Press Enter to exit"