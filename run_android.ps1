param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SupabaseAnonKey = $env:SUPABASE_ANON_KEY,
  [string]$SupabaseBucket = $env:SUPABASE_BUCKET,
  [string]$AvdName = "Medium_Phone_API_36.1",
  [int]$Port = 5173
)

function Get-DotEnvValue([string]$Key) {
  $envPath = Join-Path $PSScriptRoot ".env"
  if (-not (Test-Path $envPath)) {
    return $null
  }

  foreach ($line in Get-Content $envPath) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -match "^$Key=(.*)$") {
      $value = $matches[1].Trim()
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        return $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  $SupabaseUrl = $env:VITE_SUPABASE_URL
}
if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  $SupabaseUrl = Get-DotEnvValue "VITE_SUPABASE_URL"
}

if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  $SupabaseAnonKey = $env:VITE_SUPABASE_ANON_KEY
}
if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  $SupabaseAnonKey = Get-DotEnvValue "VITE_SUPABASE_ANON_KEY"
}

if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = $env:VITE_SUPABASE_BUCKET
}
if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = Get-DotEnvValue "VITE_SUPABASE_BUCKET"
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  Write-Host "SUPABASE_URL nao definido. Configure .env (VITE_SUPABASE_URL)." -ForegroundColor Yellow
  exit 1
}
if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  Write-Host "SUPABASE_ANON_KEY nao definido. Configure .env (VITE_SUPABASE_ANON_KEY)." -ForegroundColor Yellow
  exit 1
}
if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = "property-images"
}

$invalidUrl = $SupabaseUrl.Contains("...") -or $SupabaseUrl.Contains("YOUR_")
$invalidAnon = $SupabaseAnonKey.Contains("...") -or $SupabaseAnonKey.Contains("YOUR_")
if ($invalidUrl -or $invalidAnon) {
  Write-Host "As chaves Supabase estao com placeholders." -ForegroundColor Red
  exit 1
}

$sdkRoot = $env:ANDROID_SDK_ROOT
if ([string]::IsNullOrWhiteSpace($sdkRoot)) {
  $sdkRoot = $env:ANDROID_HOME
}
if ([string]::IsNullOrWhiteSpace($sdkRoot)) {
  $sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}

$adbPath = Join-Path $sdkRoot "platform-tools\adb.exe"
$emulatorPath = Join-Path $sdkRoot "emulator\emulator.exe"

if (-not (Test-Path $adbPath)) {
  Write-Host "ADB nao encontrado em: $adbPath" -ForegroundColor Red
  exit 1
}

& $adbPath start-server | Out-Null
$devices = & $adbPath devices
$hasEmulator = ($devices -match "emulator-\d+\s+device")

if (-not $hasEmulator) {
  if (-not (Test-Path $emulatorPath)) {
    Write-Host "Emulator nao encontrado em: $emulatorPath" -ForegroundColor Red
    exit 1
  }

  Write-Host "Iniciando AVD: $AvdName" -ForegroundColor Cyan
  Start-Process -FilePath $emulatorPath -ArgumentList "-avd", $AvdName

  Write-Host "Aguardando emulador ficar online..." -ForegroundColor Cyan
  & $adbPath wait-for-device | Out-Null

  Start-Sleep -Seconds 12
}

$cmd = @(
  ('cd /d "{0}"' -f $PSScriptRoot),
  ('set "VITE_SUPABASE_URL={0}"' -f $SupabaseUrl),
  ('set "VITE_SUPABASE_ANON_KEY={0}"' -f $SupabaseAnonKey),
  ('set "VITE_SUPABASE_BUCKET={0}"' -f $SupabaseBucket),
  "if not exist node_modules npm install",
  "npm run dev -- --host 0.0.0.0 --port $Port"
) -join " && "

Write-Host "Subindo React em novo CMD..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $cmd

Start-Sleep -Seconds 6

Write-Host "Configurando adb reverse para localhost:$Port" -ForegroundColor Cyan
& $adbPath reverse "tcp:$Port" "tcp:$Port" | Out-Null

Write-Host "Abrindo no navegador do emulador..." -ForegroundColor Cyan
& $adbPath shell am start -a android.intent.action.VIEW -d "http://localhost:$Port" | Out-Null

Write-Host "Pronto. O app React deve abrir no emulador Android." -ForegroundColor Green
