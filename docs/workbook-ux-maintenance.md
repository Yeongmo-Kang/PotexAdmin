# Workbook UX メンテナンス

## 目的
`tools/apply_workbook_ux.py` は、現在の Potex workbook UX package を再適用するための script です。単発の手作業 API 呼び出しに依存せず、見た目と操作性を戻せます。

主な用途:
- sheet 再作成後に frozen headers / filters / tab colors を戻す
- tab reset 後に conditional formatting を復元する
- README / legend tab を再投入する
- role workbook の安全な helper / source / ID 列を再度 hidden にする
- header 上の日本語 guidance note を再適用する
- editable column の dropdown validation と黄色の入力強調を戻す
- 列グループ header 色、実用的な列幅、comment 列の wrap を戻す

## Script
Path:
- `tools/apply_workbook_ux.py`

## 必要条件
- Google OAuth token: `~/.hermes/google_token.json`
- Python 環境に次が入っていること
  - `google-auth`
  - `google-auth-httplib2`
  - `google-api-python-client`

## 使い方

### 管理対象 workbook すべてに再適用
```bash
python tools/apply_workbook_ux.py --scope all
```

### 1 つの workbook group だけ再適用
```bash
python tools/apply_workbook_ux.py --scope sales
python tools/apply_workbook_ux.py --scope coaches
python tools/apply_workbook_ux.py --scope concierge
python tools/apply_workbook_ux.py --scope db
```

### README + hidden helper columns だけ再適用
```bash
python tools/apply_workbook_ux.py --readmes-only
```

## 現在の対象範囲

### Role workbook
- `Potex CS`
- `Potex Executive`
- `Potex Sales`
- `Potex Coaches`
- `Potex Concierge`

### Admin workbook の対象 section
- `Sync_Log`
- `Sync_Control`
- `Publish_Manifest`
- `Exceptions_FeedbackMatch`
- `Exceptions_ContinuationMatch`
- `Staging_Payments`
- `Customer_Coach_Assignments`

### 追加の second-pass cleanup
- `営業_使い方`, `コーチ_使い方`, `コンシェルジュ_使い方` を再投入
- 一部の `CS` / `Sales` / `Coaches` / `Concierge` tab で、安全な helper/source/id 列を再 hidden 化

## 注意
- この script は意図的に保守的です。operator UX 上、安全と判断済みの列だけを hidden にします。
- `POTEX DB` は operator workbook ではなく、admin / debug workbook として扱います。
- publish schema が変わったら、`HIDE_COLUMNS` の header 名や `apply_baseline_and_signals()` の formula を更新してください。

## 推奨運用
workbook / tab を再作成した、または publish reset で formatting が消えたときは、次の順で実施します。
1. 先に該当 publish job を実行する
2. `tools/apply_workbook_ux.py` を実行する
3. 重要 tab を目視 spot-check する
4. hidden helper columns と README legend が現在 schema と一致していることを確認する
