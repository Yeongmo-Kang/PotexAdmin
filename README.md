# Potex プロジェクトワークスペース

このリポジトリは、Potex 業務を安全に進めるための専用ワークスペースです。

## このプロジェクトの目的
- Potex の運用・改善作業を他案件と分けて管理する
- `POTEX DB` を中心に、役割別 workbook を publish / writeback する運用を維持する
- 非技術メンバーでも読める文書・ガイドを GitHub 上で一元管理する
- GitHub `origin/main` を一次基準にし、ローカルは作業コピー兼バックアップとして扱う

## まず守ること
**現在運用中の source / reference スプレッドシートは直接編集・削除しないこと。**

読み取り専用の元シート:
- `受講者管理`
- `顧客満足度会議`
- `月次振り返りアンケート （回答）`
- `⭕️使用中｜POTEX数値管理`

## 現在の管理対象 workbook
- `POTEX DB`：正本データベース workbook
- `Potex CS`：CS 運用 workbook
- `Potex Executive`：経営確認 workbook
- `Potex Concierge`：コンシェルジュ向け read-only workbook
- `Potex Sales`：営業向け read-only workbook
- `Potex Coaches`：コーチ向け read-only workbook

## 新しく入る人向けの読む順番
1. `CLAUDE.md` — プロジェクト前提・制約・現状メモ
2. `agents/workflow.md` — 作業の進め方
3. `docs/backlog.md` — 今やること / 後でやること
4. `agents/session.md` — 最新セッション状態
5. `OPERATIONS_MANUAL.md` — 運用ガイド
6. `docs/database-overview.md` — DB 全体像
7. `docs/sheet-reference.md` — シート別リファレンス
8. `docs/repo-resilience.md` — GitHub / ローカル復旧手順
9. `docs/architecture-guardrails.md` — GAS モジュール境界と変更ルール

## 一次基準の文書
- 公式な文書・コードの一次基準: GitHub repo `origin` (`Yeongmo-Kang/PotexAdmin`, branch `main`)
- ローカル作業コピー: `/home/ubuntu/.hermes/projects/PotexAdmin`
- 復旧手順: `docs/repo-resilience.md`
- DB 全体像: `docs/database-overview.md`
- シート別仕様: `docs/sheet-reference.md`
- 運用手順: `OPERATIONS_MANUAL.md`
- workbook 構成: `OPS_WORKBOOK_ARCHITECTURE.md`
- アーキテクチャガードレール: `docs/architecture-guardrails.md`
- backlog: `docs/backlog.md`
- セッション状態: `agents/session.md`

## この repo の運用ルール
- 重要な変更は、まず GitHub `main` に残す
- ローカルだけのメモは一時退避と考え、必要なら文書として commit する
- source シートは read-only、正本は `POTEX DB` のみ
- publish シートへの手入力はしない。入力は明示された input タブから行う
- operator-facing の表示は日本語を優先し、内部キーは英語 snake_case を維持する

## 主要パス
- GAS コード: `potex-gas/`
- backlog: `docs/backlog.md`
- session checkpoint: `agents/session.md`
- workbook manifest: `workbook_manifest.json`
- generated 出力: `generated/`
