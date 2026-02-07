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

function Stop-PortProcess([int]$TargetPort) {
  $matches = netstat -ano | Select-String ":$TargetPort\\s+.*LISTENING\\s+(\\d+)$"
  $pids = @()

  foreach ($m in $matches) {
    if ($m.Matches.Count -gt 0) {
      $pids += [int]$m.Matches[0].Groups[1].Value
    }
  }

  $pids = $pids | Select-Object -Unique

  foreach ($pidValue in $pids) {
    if ($pidValue -eq $PID) {
      continue
    }

    try {
      Stop-Process -Id $pidValue -Force -ErrorAction Stop
      Write-Host "Encerrado processo PID $pidValue na porta $TargetPort." -ForegroundColor Yellow
    } catch {
      Write-Host "Nao foi possivel encerrar PID $pidValue (porta $TargetPort)." -ForegroundColor DarkYellow
    }
  }
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

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  Write-Host 'SUPABASE_URL nao definido. Configure .env (VITE_SUPABASE_URL).' -ForegroundColor Yellow
  exit 1
}
if ([string]::IsNullOrWhiteSpace($SupabaseAnonKey)) {
  Write-Host 'SUPABASE_ANON_KEY nao definido. Configure .env (VITE_SUPABASE_ANON_KEY).' -ForegroundColor Yellow
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

Stop-PortProcess -TargetPort $Port

$cmd = @(
  "cd /d $PSScriptRoot",
  ('set "VITE_SUPABASE_URL={0}"' -f $SupabaseUrl),
  ('set "VITE_SUPABASE_ANON_KEY={0}"' -f $SupabaseAnonKey),
  ('set "VITE_SUPABASE_BUCKET={0}"' -f $SupabaseBucket),
  'if not exist node_modules npm install',
  "npm run dev -- --host 127.0.0.1 --port $Port --strictPort"
) -join ' && '

Write-Host 'Subindo app React local...' -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $cmd

Start-Sleep -Seconds 2
$localUrl = "http://127.0.0.1:$Port"
Start-Process $localUrl

Write-Host "App local: $localUrl" -ForegroundColor Green
