# Potex セッションチェックポイント

更新: 2026-05-24T23:24:13+09:00

## いまの前提
- GitHub repo `origin` (`Yeongmo-Kang/PotexAdmin`, branch `main`) を文書・コード・計画の一次基準にする
- ローカル workspace (`/home/ubuntu/.hermes/projects/PotexAdmin`) は作業コピー兼バックアップ
- source/reference workbook 4種は read-only
- `POTEX DB` のみ canonical database
- publish シートへの手入力は禁止。入力は明示された input タブから行う
- operator-facing の表示は日本語、内部キーは英語 snake_case を維持する

## 現在の状態
- branch: `main`
- latest pushed commit: `3e0dc28` (`docs: add repo resilience and local backup safeguards`)
- remotes:
  - `origin` → `git@github.com:Yeongmo-Kang/PotexAdmin.git`
  - `backup-local` → `/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git`
- local working tree: clean

## 2026-05-24 までに確認済みの重要事項
- Executive workbook の freshness / trust 機能は live 反映済み
  - `経営_会議前チェック`
  - `経営_更新状況`
  - `経営_データ状況` の trust 指標拡張
- 直近の live verify では meeting risk は `GO`
- stale domains / human omission は 0 件の状態を確認済み
- deploy 経路は global clasp 優先の形に調整済み
- GitHub main を一次基準にする方針を README / backlog / session / plan に反映済み
- repo resilience:
  - bare mirror: `/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git`
  - bundle backup: `/home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/`
  - cron: 6時間ごとに backup script 実行

## いま本当に残っている作業
### 1. 運用承認キューの前進
- `CS_入金名寄せ確認` P1 = 39
- `CS_継続名寄せ確認` P1 = 10
- これは主に operator 実行待ち

### 2. Partner assignment の最終方針整理
- partner を独立 canonical にし続けるのではなく、`Coaches` / `Customer_Coach_Assignments` に吸収する最終像で説明・実装・運用を揃える

### 3. Customers cutover 前提整理
- ownership matrix
- `Customer_Edit_History` 設計

## 今すぐ再開するときの順番
1. `docs/backlog.md` を読む
2. operator 実行待ちか、実装作業か、文書整理かを切り分ける
3. 実装する場合は source workbook を触らず、DB / publish / writeback 側だけ触る
4. 変更後は build / deploy / verify / doc update の順で締める

## 参考文書
- `README.md`
- `docs/backlog.md`
- `OPERATIONS_MANUAL.md`
- `docs/repo-resilience.md`
- `docs/plans/2026-05-24-executive-data-trust-and-freshness-plan.md`
