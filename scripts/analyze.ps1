<#
.SYNOPSIS
  Harness-Insight analyzer (PowerShell fallback)。analyze.js と同等の指標を計算する。
.PARAMETER InputFile
  共通スキーマ JSONL のパス。省略時は .\.harness_insights\normalized.jsonl
#>
param(
  [string]$InputFile = ".\.harness_insights\normalized.jsonl"
)

$ErrorActionPreference = 'Stop'

$OutDir = Join-Path (Get-Location) ".harness_insights"
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$OutFile = Join-Path $OutDir "metrics.json"
$History = Join-Path $OutDir "history.jsonl"

if (-not (Test-Path $InputFile)) {
  Write-Error "[harness-insight] missing $InputFile"
  exit 2
}

$events = @()
foreach ($line in Get-Content $InputFile) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try { $o = $line | ConvertFrom-Json } catch { continue }
  $t = 0.0
  try { $t = ([datetime]::Parse($o.ts)).ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds } catch {}
  $o | Add-Member -NotePropertyName _t -NotePropertyValue $t -Force
  $events += $o
}
$events = $events | Sort-Object _t

$ai = ($events | Where-Object { $_.actor -eq 'ai' }).Count
$usr = ($events | Where-Object { $_.actor -eq 'user' }).Count
$prompts = $events | Where-Object { $_.action_type -eq 'prompt' }
$edits = $events | Where-Object { $_.action_type -eq 'code_edit' }
$interrupts = ($events | Where-Object { $_.action_type -eq 'interrupt' }).Count

# 機会損失計算
$blocks = New-Object System.Collections.Generic.List[object]
$cur = $null; $inWin = $false
foreach ($e in $events) {
  if ($e.actor -eq 'ai' -and $e.action_type -eq 'ai_response') { $inWin = $true; $cur = $null; continue }
  if ($e.actor -eq 'user' -and $e.action_type -eq 'prompt') {
    if ($cur) { $blocks.Add($cur) }
    $cur = $null; $inWin = $false; continue
  }
  if ($inWin -and $e.actor -eq 'user' -and $e.action_type -eq 'code_edit') {
    if (-not $cur) { $cur = @{ start = $e._t; end = $e._t } }
    else { $cur.end = $e._t }
  }
}
if ($cur) { $blocks.Add($cur) }
$mins = $blocks | ForEach-Object { [Math]::Max(0, ($_.end - $_.start) / 60000) }
$manualMin = [Math]::Round((($mins | Measure-Object -Sum).Sum), 1)
$oppLoss = ($mins | Where-Object { $_ -ge 5 }).Count

# clarity
$constraintRe = '(?i)(must|do not|don.?t|format|json|markdown|step by step|制約|形式|必ず|禁止)'
$clarity = 0
if ($prompts.Count -gt 0) {
  $sum = 0
  foreach ($p in $prompts) {
    $c = [string]$p.content
    $s = 50
    if ($c.Length -gt 60)  { $s += 15 }
    if ($c.Length -gt 200) { $s += 10 }
    if ($c -match $constraintRe) { $s += 25 }
    $sum += [Math]::Min(100, $s)
  }
  $clarity = [Math]::Round($sum / $prompts.Count)
}

# rework
$counts = @{}
foreach ($e in $edits) {
  $files = @()
  if ($e.meta -and $e.meta.files) { $files = $e.meta.files }
  foreach ($f in $files) { $counts[$f] = ($counts[$f] | ForEach-Object { $_ }) + 1 }
}
$total = ($counts.Values | Measure-Object -Sum).Sum
$repeated = ($counts.Values | Where-Object { $_ -gt 1 } | Measure-Object -Sum).Sum
$rework = if ($total) { [Math]::Round(($repeated / $total) * 1000) / 10 } else { 0 }

$delegation = if (($ai + $usr) -gt 0) { [Math]::Round(($ai / ($ai + $usr)) * 1000) / 10 } else { 0 }
$oppPenalty = -($oppLoss * 3)
$intrPenalty = -($interrupts * 4)
$reworkPenalty = -([Math]::Max(0, $rework - 30) * 0.5)
$totalScore = [Math]::Max(0, [Math]::Round(100 + $oppPenalty + $intrPenalty + $reworkPenalty))

$metrics = [ordered]@{
  generated_at           = (Get-Date).ToUniversalTime().ToString('o')
  counts                 = @{ events = $events.Count; prompts = $prompts.Count; edits = $edits.Count; interrupts = $interrupts }
  delegation_score       = $delegation
  prompt_clarity         = $clarity
  manual_coding_time_min = $manualMin
  opportunity_loss_count = $oppLoss
  interrupt_count        = $interrupts
  rework_ratio           = $rework
  total_score            = $totalScore
  breakdown              = [ordered]@{
    delegation_contrib   = [Math]::Round($delegation * 0.30, 1)
    clarity_contrib      = [Math]::Round($clarity * 0.20, 1)
    opportunity_penalty  = $oppPenalty
    interrupt_penalty    = $intrPenalty
    rework_penalty       = [Math]::Round($reworkPenalty, 1)
    formula              = '100 - opportunity_loss_count×3 - interrupt_count×4 - max(0, rework_ratio-30)×0.5'
  }
}

$json = $metrics | ConvertTo-Json -Depth 6
$json | Set-Content -Path $OutFile -Encoding UTF8
Add-Content -Path $History -Value ($metrics | ConvertTo-Json -Compress -Depth 6) -Encoding UTF8
Write-Output $json
