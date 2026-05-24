# Potex セッションチェックポイント

更新: 2026-05-25T01:20:35+09:00

## いまの前提
- GitHub repo `origin` (`Yeongmo-Kang/PotexAdmin`, branch `main`) を文書・コード・計画の一次基準にする
- ローカル workspace (`/home/ubuntu/.hermes/projects/PotexAdmin`) は作業コピー兼バックアップ
- source/reference workbook 4種は read-only
- `POTEX DB` のみ canonical database
- publish シートへの手入力は禁止。入力は明示された input タブから行う
- operator-facing の表示は日本語、内部キーは英語 snake_case を維持する
- ERP 化を見据え、業務機能は feature 単位で分離しやすい形を優先する
- operator UX は「直感的で迷わないこと」を最優先にする

## 現在の状態
- branch: `main`
- remotes:
  - `origin` → `git@github.com:Yeongmo-Kang/PotexAdmin.git`
  - `backup-local` → `/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git`
- local working tree: この文書更新コミット前は docs 変更あり、通常運用では clean を維持する
- 最新の重要反映:
  - repo resilience 整備
  - Windows auto-update scripts 追加
  - `main.ts` orchestration 重複縮小
  - architecture / ERP modularization / operator UX guardrails 追加
  - `publish/views/` feature facade 分離
  - `contracts/` ベースの writeback input contract 集約
  - `CS_承認診断` / 拡張 `CS_承認進捗` / approval inspect script 追加

## 2026-05-25 時点の実態整理
### 稼働中のもの
- live workbook 6 系統は稼働中
- trigger cadence は継続稼働中
  - publish: 1時間ごと
  - writeback: 30分ごと
  - full refresh: 毎日 07:00 JST
- GitHub main / bare mirror / bundle backup / repo backup cron は有効

### いま本当に残っている作業
1. ERP module map / customer ownership / `Customer_Edit_History` 設計
2. facade の内側に残る `publish/views.ts` helper の段階移管
3. live workbook で `CS_承認診断` / 拡張 `CS_承認進捗` / inspect script の運用確認
4. その後に営業自動化 (`P-013`) の前提整理
5. operator 実処理が必要な approval queue の前進

### 人入力が必要なもの
- `CS_入金名寄せ確認` / `CS_継続名寄せ確認` の承認処理
- customer ownership matrix の業務判断

## 今すぐ再開するときの順番
1. `docs/backlog.md` を読む
2. `docs/plans/2026-05-25-automation-and-erp-roadmap.md` を読む
3. 実装ならまず `publish/views.ts` 分割から着手する
4. 変更後は `npm run typecheck` → `npm run build` → 必要なら live verify → doc update の順で締める

## 参考文書
- `README.md`
- `docs/backlog.md`
- `docs/architecture-guardrails.md`
- `docs/plans/2026-05-25-automation-and-erp-roadmap.md`
- `OPERATIONS_MANUAL.md`
- `docs/repo-resilience.md`
