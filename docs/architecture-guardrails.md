# PotexAdmin アーキテクチャガードレール

この文書は、PotexAdmin を今後も壊れにくく保つための最小ルールをまとめたものです。特に `potex-gas/src/` 配下で、処理責務の混線を防ぐことを目的とします。

## 現在のモジュール境界

- `canonical/`
  - source workbook から canonical / staging を組み立てる層
  - 顧客、商流、LINE、フィードバックなどの正規化ロジックを置く
- `publish/`
  - canonical シートを各 operator workbook 向けの view に変換する層
  - CS / 営業 / 経営 / コーチ / パートナー向け表示の整形を担当する
- `writeback/`
  - operator workbook の入力を canonical / source に戻す層
  - alias 解決、担当割当、パートナー状況入力などを扱う
- `ui/`
  - Spreadsheet UI メニュー、operator 起点の操作導線のみ
- `triggers/`
  - 時間主導の orchestration のみ
- `config.ts`, `constants.ts`, `sheets.ts`, `logging.ts`, `locks.ts`
  - 横断的ユーティリティ

## 依存方向ルール

### 許可される依存方向
- `ui/` → `main.ts` / `bootstrap.ts`
- `triggers/` → `main.ts`
- `main.ts` → `canonical/`, `publish/`, `writeback/`, `config.ts`, `logging.ts`
- `publish/` → `constants.ts`, `sheets.ts`, `config.ts`, `canonical/` の純粋 helper
- `writeback/` → `constants.ts`, `sheets.ts`, `config.ts`, `canonical/` の ID/正規化 helper
- `canonical/` → `constants.ts`, `sheets.ts`, `config.ts`

### 禁止する依存
- `publish/` から `writeback/` を直接 import しない
- `writeback/` から `publish/` を直接 import しない
- `canonical/` から `publish/` / `ui/` を参照しない
- `ui/` に canonical 整形や workbook 変換ロジックを入れない
- 巨大 view 生成関数の中に source workbook の読み出し責務を混ぜない

## 実装ルール

1. **source 読み出しは orchestration 側でまとめる**
   - workbook を開く責務は `main.ts` または各 publish/writeback エントリに寄せる
   - view builder は「受け取った rows から 2 次元配列を返す」形を優先する

2. **view builder は副作用を持たせない**
   - `publish/views.ts` 系の関数は `SpreadsheetApp.openById` を呼ばない
   - 入力 rows → 出力 matrix の変換に徹する

3. **writeback は publish 契約を前提にしない**
   - writeback 側は view 表示順ではなく、列キーと入力契約で判断する
   - 表示ラベル変更だけで writeback が壊れない構造を保つ

4. **operator 向け表示だけ日本語化する**
   - DB/canonical の列名は英語 snake_case のまま維持
   - visible enum / sheet title / README だけ日本語化する

5. **重複 orchestration を増やさない**
   - refresh → writeback → publish の再実行条件は `main.ts` に集約する
   - 同じ条件分岐を複数 workflow にコピペしない

## ERP への移行を見据えたモジュール化原則

PotexAdmin は将来的に ERP 的な業務モジュールへ切り出しやすい形を優先する。
そのため、新規実装やリファクタ時は「今の spreadsheet 運用で便利か」だけでなく、「後で独立モジュールとして分離できるか」を必ず確認する。

### モジュール化の判断基準
- 1つの処理が **単一業務責務** を持っているか
- 入出力契約が **列キー / 関数引数 / 戻り値** で明確か
- 他機能の内部表現に直接依存せず、境界越しに連携できるか
- spreadsheet 表示都合と canonical 業務ルールが同じ関数に混ざっていないか

### 先に分けるべき業務単位
- 顧客マスタ / 顧客同定
- コーチ / 担当割当
- LINE / チャネル紐付け
- セッション / 受講進捗
- フィードバック / 満足度
- 継続提案 / 契約・入金
- CS フォローアップ
- 経営向け集計 / データ健全性
- パートナー送客 / パートナー状況更新

### 実装時の具体ルール
- canonical ルールは feature ごとの helper に閉じ込める
- publish view は feature ごとの selector / formatter に寄せる
- writeback は feature ごとの input contract を明示する
- 1つのファイルに複数業務の列定義・判定・表示文言を増やし続けない
- 将来 API 化するときに、そのまま service 単位へ移せる粒度を目指す

### operator UX 原則
- operator が次に何をすべきか、シート名・列名・README だけ見て直感的に分かること
- 内部都合の英語キーは DB/canonical に残し、operator-facing 表示は平易な日本語にすること
- 入力セルと非入力セルを明確に分け、誤編集しにくい構成を優先すること
- 例外処理や確認待ちは「保留」「要確認」「承認済み」など意味が一目で分かる状態名で出すこと
- 説明は短く実務的に書き、 operator に実装都合や内部構造を覚えさせないこと

## 次の分割方針

現在 `publish/views.ts` が大きいため、今後の追加は以下単位で分割する。

- `publish/views/cs.ts`
- `publish/views/executive.ts`
- `publish/views/sales.ts`
- `publish/views/coach.ts`
- `publish/views/concierge.ts`
- `publish/views/partner.ts`
- `publish/views/shared.ts`

新規 view を追加するときは、まずこの分割先を作り、既存巨大ファイルへ追記し続けないこと。

## 変更前チェック

変更前に最低限確認すること:
- このロジックは canonical / publish / writeback / ui のどこに属するか
- 他層を直接参照せずに済むか
- operator 表示変更だけなのに canonical 契約まで崩していないか
- 同じ orchestration 条件を別箇所に複製していないか

このガードレールに従うことで、PotexAdmin は「スプレッドシート運用中心」でありながら、責務が崩れにくい構成を維持できます。
