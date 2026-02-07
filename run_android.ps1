param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SupabaseAnonKey = $env:SUPABASE_ANON_KEY,
  [string]$SupabaseBucket = $env:SUPABASE_BUCKET,
  [string]$EmulatorId = "Medium_Phone_API_36.1"
)

function Get-LocalPropertyValue([string]$Key) {
  $localPropsPath = Join-Path $PSScriptRoot "android\local.properties"
  if (-not (Test-Path $localPropsPath)) { return $null }
  $line = Get-Content $localPropsPath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^$Key=", "").Trim()
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  $SupabaseUrl = Get-LocalPropertyValue "SUPABASE_URL"
}
if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  $SupabaseAnonKey = Get-LocalPropertyValue "SUPABASE_ANON_KEY"
}
if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = Get-LocalPropertyValue "SUPABASE_BUCKET"
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  Write-Host "SUPABASE_URL nao definido." -ForegroundColor Yellow
  exit 1
}
if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  Write-Host "SUPABASE_ANON_KEY nao definido." -ForegroundColor Yellow
  exit 1
}
if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = "property-images"
}

$invalidUrl = $SupabaseUrl.Contains("...") -or $SupabaseUrl.Contains("YOUR_")
$invalidAnon = $SupabaseAnonKey.Contains("...") -or $SupabaseAnonKey.Contains("YOUR_")
if ($invalidUrl -or $invalidAnon) {
  Write-Host "As chaves Supabase estao com placeholders (ex: ... ou YOUR_)." -ForegroundColor Red
  Write-Host "Ajuste android/local.properties ou passe -SupabaseUrl/-SupabaseAnonKey reais." -ForegroundColor Yellow
  exit 1
}

$adb = "C:\Users\Pichau\AppData\Local\Android\sdk\platform-tools\adb.exe"
$deviceOnline = $false

if (Test-Path $adb) {
  & $adb start-server | Out-Null
  $adbList = & $adb devices
  if ($adbList -match "emulator-5554\s+device") {
    $deviceOnline = $true
  }
}

if (-not $deviceOnline) {
  Write-Host "Iniciando emulador: $EmulatorId" -ForegroundColor Cyan
  flutter emulators --launch $EmulatorId | Out-Null
  if (Test-Path $adb) {
    & $adb wait-for-device | Out-Null
  }
}

$cmd = "flutter run -d emulator-5554 --dart-define=SUPABASE_URL=$SupabaseUrl --dart-define=SUPABASE_ANON_KEY=$SupabaseAnonKey --dart-define=SUPABASE_BUCKET=$SupabaseBucket"
Write-Host "Executando: $cmd" -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d $PSScriptRoot && $cmd"
