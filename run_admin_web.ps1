param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SupabaseAnonKey = $env:SUPABASE_ANON_KEY,
  [string]$SupabaseBucket = $env:SUPABASE_BUCKET,
  [int]$Port = 5173
)

function Get-DotEnvValue([string]$Key) {
  $envPath = Join-Path $PSScriptRoot '.env'
  if (-not (Test-Path $envPath)) {
    return $null
  }

  foreach ($line in Get-Content $envPath) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
      continue
    }

    if ($trimmed -match "^$Key=(.*)$") {
      $value = $matches[1].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
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
  $SupabaseUrl = Get-DotEnvValue 'VITE_SUPABASE_URL'
}

if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  $SupabaseAnonKey = $env:VITE_SUPABASE_ANON_KEY
}
if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  $SupabaseAnonKey = Get-DotEnvValue 'VITE_SUPABASE_ANON_KEY'
}

if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = $env:VITE_SUPABASE_BUCKET
}
if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = Get-DotEnvValue 'VITE_SUPABASE_BUCKET'
}

if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or [string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  Write-Host 'Configure .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.' -ForegroundColor Yellow
  exit 1
}
if ([string]::IsNullOrWhiteSpace($SupabaseBucket)) {
  $SupabaseBucket = 'property-images'
}

$invalidUrl = $SupabaseUrl.Contains('...') -or $SupabaseUrl.Contains('YOUR_')
$invalidAnon = $SupabaseAnonKey.Contains('...') -or $SupabaseAnonKey.Contains('YOUR_')
if ($invalidUrl -or $invalidAnon) {
  Write-Host 'As chaves Supabase estao com placeholders.' -ForegroundColor Red
  exit 1
}

$localAdminUrl = "http://127.0.0.1:$Port/admin.html"
$hasServer = netstat -ano | Select-String ":$Port\s+.*LISTENING"

if ($hasServer) {
  Write-Host "Servidor local ja ativo na porta $Port. Abrindo admin..." -ForegroundColor Cyan
  Start-Process $localAdminUrl
  Write-Host "Admin local: $localAdminUrl" -ForegroundColor Green
  exit 0
}

$launcherPath = Join-Path $PSScriptRoot '.run_admin_local.cmd'
$launcherLines = @(
  '@echo off',
  ('cd /d "{0}"' -f $PSScriptRoot),
  ('set "VITE_SUPABASE_URL={0}"' -f $SupabaseUrl),
  ('set "VITE_SUPABASE_ANON_KEY={0}"' -f $SupabaseAnonKey),
  ('set "VITE_SUPABASE_BUCKET={0}"' -f $SupabaseBucket),
  'if not exist node_modules npm install',
  ('npm run dev -- --host 127.0.0.1 --port {0} --strictPort' -f $Port)
)
$launcherLines | Set-Content -Path $launcherPath -Encoding ascii

Write-Host 'Subindo servidor local para admin...' -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', ('"{0}"' -f $launcherPath)

Start-Sleep -Seconds 2
Start-Process $localAdminUrl
Write-Host "Admin local: $localAdminUrl" -ForegroundColor Green
