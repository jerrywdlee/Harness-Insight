# LLM Fallback Prompt (when parsers are unavailable)

Node, Python, and PowerShell are unavailable, or parser execution has crashed.
Read the normalized JSONL directly and estimate `metrics.json`.

## Required Output JSON
```json
{
  "delegation_score": <0-100>,
  "prompt_clarity": <0-100>,
  "manual_coding_time_min": <number>,
  "opportunity_loss_count": <int>,
  "interrupt_count": <int>,
  "rework_ratio": <0-100>,
  "total_score": <0-100>,
  "breakdown": {
    "delegation_contrib": <number>,
    "clarity_contrib": <number>,
    "opportunity_penalty": <number>,
    "interrupt_penalty": <number>,
    "rework_penalty": <number>,
    "formula": "100 - opp×3 - intr×4 - max(0,rework-30)×0.5"
  },
  "evidence": [
    "<up to 5 evidence log excerpts>"
  ]
}
```

  ## Rules
  1. If `actor=user` and `action_type=code_edit` continues for 5 minutes or more immediately after `ai_response`, count it as `opportunity_loss_count`.
  2. If the same `meta.files[*]` appears in multiple `code_edit` events, reflect it in `rework_ratio`.
  3. Output JSON only. Do not output any prose outside JSON.
  4. If an estimate is uncertain, include evidence log IDs or line references in `evidence[]`.
  5. `total_score` must use this formula, and each component must be shown in `breakdown`:
    `total_score = 100 - opportunity_loss_count*3 - interrupt_count*4 - max(0, rework_ratio-30)*0.5`
  6. The output JSON must include a `breakdown` key:
   ```json
   "breakdown": {
     "delegation_contrib":   <delegation_score × 0.30>,
     "clarity_contrib":      <prompt_clarity × 0.20>,
     "opportunity_penalty":  <-opportunity_loss_count × 3>,
     "interrupt_penalty":    <-interrupt_count × 4>,
     "rework_penalty":       <-max(0, rework_ratio - 30) × 0.5>,
     "formula": "100 - opp×3 - intr×4 - max(0,rework-30)×0.5"
   }
   ```

## Few-shot Example
Input (partial):
```
{"ts":"...T10:00:00Z","actor":"ai","action_type":"ai_response","content":"..."}
{"ts":"...T10:01:00Z","actor":"user","action_type":"code_edit","content":"..."}
{"ts":"...T10:09:00Z","actor":"user","action_type":"code_edit","content":"..."}
{"ts":"...T10:10:00Z","actor":"user","action_type":"prompt","content":"This is not correct, try again"}
```
Output:
```json
{
  "manual_coding_time_min": 9,
  "opportunity_loss_count": 1,
  "interrupt_count": 0,
  "evidence": ["10:01-10:09 continuous edits (8min), followed by rework request"]
}
```
