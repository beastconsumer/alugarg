param(
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
  $matches = netstat -ano | Select-String ":$TargetPort\s+.*LISTENING\s+(\d+)$"
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

$supabaseUrl = Get-DotEnvValue 'VITE_SUPABASE_URL'
$supabaseAnonKey = Get-DotEnvValue 'VITE_SUPABASE_ANON_KEY'
$supabaseBucket = Get-DotEnvValue 'VITE_SUPABASE_BUCKET'

if ([string]::IsNullOrWhiteSpace($supabaseUrl) -or [string]::IsNullOrWhiteSpace($supabaseAnonKey)) {
  Write-Host 'Falta VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY no .env.' -ForegroundColor Red
  exit 1
}

if ([string]::IsNullOrWhiteSpace($supabaseBucket)) {
  $supabaseBucket = 'property-images'
}

$cloudflaredPath = Join-Path $PSScriptRoot '.tools\cloudflared.exe'
if (-not (Test-Path $cloudflaredPath)) {
  Write-Host 'cloudflared nao encontrado em .tools\cloudflared.exe' -ForegroundColor Red
  exit 1
}

Stop-PortProcess -TargetPort $Port

$launcherPath = Join-Path $PSScriptRoot '.run_web_local.cmd'
$launcherLines = @(
  '@echo off',
  ('cd /d "{0}"' -f $PSScriptRoot),
  ('set "VITE_SUPABASE_URL={0}"' -f $supabaseUrl),
  ('set "VITE_SUPABASE_ANON_KEY={0}"' -f $supabaseAnonKey),
  ('set "VITE_SUPABASE_BUCKET={0}"' -f $supabaseBucket),
  'if not exist node_modules npm install',
  ('npm run dev -- --host 127.0.0.1 --port {0} --strictPort' -f $Port)
)
$launcherLines | Set-Content -Path $launcherPath -Encoding ascii

Write-Host 'Subindo app local...' -ForegroundColor Cyan
$appProc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', ('"{0}"' -f $launcherPath) -PassThru

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 1000
  try {
    $status = (Invoke-WebRequest -UseBasicParsing ("http://127.0.0.1:{0}" -f $Port) -TimeoutSec 2).StatusCode
    if ($status -ge 200 -and $status -lt 500) {
      $ready = $true
      break
    }
  } catch {
    # wait
  }
}

if (-not $ready) {
  Write-Host 'App nao ficou pronto na porta local.' -ForegroundColor Red
  exit 1
}

$tunnelLog = Join-Path $PSScriptRoot '.share_tunnel.log'
if (Test-Path $tunnelLog) {
  Remove-Item $tunnelLog -Force
}

Write-Host 'Abrindo tunel publico...' -ForegroundColor Cyan
$arg = '/c "{0}" tunnel --url http://127.0.0.1:{1} --no-autoupdate > "{2}" 2>&1' -f $cloudflaredPath, $Port, $tunnelLog
$tunnelProc = Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -PassThru

$publicUrl = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tunnelLog) {
    $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
    if ($content -match 'https://[-a-zA-Z0-9]+\.trycloudflare\.com') {
      $publicUrl = $matches[0]
      break
    }
  }
}

if (-not $publicUrl) {
  Write-Host 'Nao consegui capturar URL publica. Veja .share_tunnel.log' -ForegroundColor Red
  exit 1
}

$pidFile = Join-Path $PSScriptRoot '.share_pids.txt'
@(
  ('APP_PID={0}' -f $appProc.Id),
  ('TUNNEL_PID={0}' -f $tunnelProc.Id),
  ('PORT={0}' -f $Port),
  ('URL={0}' -f $publicUrl)
) | Set-Content -Path $pidFile -Encoding ascii

Write-Host "App local: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Link publico: $publicUrl" -ForegroundColor Green
Write-Host "Para encerrar: Stop-Process -Id $($appProc.Id),$($tunnelProc.Id) -Force" -ForegroundColor Yellow

Start-Process $publicUrl
