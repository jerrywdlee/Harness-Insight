# LLM Fallback Prompt（パーサー実行不可時）

> Node / Python / PowerShell いずれも利用不可、もしくはパーサーがクラッシュしました。
> あなたは正規化ログ JSONL を直接読み、`metrics.json` を **力技で推計** して下さい。

## 必須出力 JSON
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
    "<根拠となるログ抜粋を最大5件>"
  ]
}
```

## ルール
1. `actor=user` & `action_type=code_edit` が `ai_response` 直後に **5 分以上連続** している箇所を `opportunity_loss_count` とする（タイムスタンプの差分から推計）。
2. 同一 `meta.files[*]` に対する `code_edit` が複数あるなら `rework_ratio` に反映。
3. JSON 以外の説明文を **絶対に出力しない**。
4. 推計に不確実性がある項目は `evidence[]` に根拠ログ ID もしくは行番号を必ず添える。
5. **`total_score` は必ず以下の計算式で算出**し、各構成要素を `breakdown` に明示する：
   `total_score = 100 − opportunity_loss_count×3 − interrupt_count×4 − max(0, rework_ratio−30)×0.5`
6. 出力 JSON に **`breakdown` キーを必ず含める**：
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

## Few-shot 例
入力（一部）:
```
{"ts":"...T10:00:00Z","actor":"ai","action_type":"ai_response","content":"..."}
{"ts":"...T10:01:00Z","actor":"user","action_type":"code_edit","content":"..."}
{"ts":"...T10:09:00Z","actor":"user","action_type":"code_edit","content":"..."}
{"ts":"...T10:10:00Z","actor":"user","action_type":"prompt","content":"違う、もう一度"}
```
出力:
```json
{
  "manual_coding_time_min": 9,
  "opportunity_loss_count": 1,
  "interrupt_count": 0,
  "evidence": ["10:01-10:09 連続編集 (8min) 直後にやり直し依頼"]
}
```
