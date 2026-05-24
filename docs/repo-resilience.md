# Repo 復旧・バックアップ手順

## この文書の目的
`PotexAdmin` を、次のどちらかが失われても復旧できる状態に保つ。
- GitHub repo (`origin`)
- ローカル作業コピー (`/home/ubuntu/.hermes/projects/PotexAdmin`)

## 現在あるコピー
- 主 remote: `git@github.com:Yeongmo-Kang/PotexAdmin.git`
- 作業コピー: `/home/ubuntu/.hermes/projects/PotexAdmin`
- ローカル bare mirror: `/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git`
- ローカル bundle snapshot: `/home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/`

## 自動バックアップ
6時間ごとに host 側 cron で mirror 更新と bundle 検証を実行する。

- cron entry:
  - `0 */6 * * * /home/ubuntu/.hermes/scripts/potexadmin_git_resilience_backup.sh >> /home/ubuntu/.hermes/logs/potexadmin_git_backup.log 2>&1`
- script:
  - `~/.hermes/scripts/potexadmin_git_resilience_backup.sh`
- 権限:
  - backup 保存先は `ubuntu` ユーザーだけが読めるよう制限済み
  - directory は基本 `700`
  - backup file は基本 `600`

## この仕組みで守れるもの
- 作業コピーの削除・破損
- GitHub 一時停止
- GitHub repo を作り直す必要が出た場合の履歴復旧

## この仕組みだけでは守れないもの
- VPS 全体の消失
- ディスク故障
- `ubuntu` アカウント自体の侵害
- commit 前の未保存変更
- ignore 対象のローカル専用ファイル

**重要:** この backup が守るのは、あくまで **commit 済みの Git 履歴**。
未 commit の編集内容やローカル credential は対象外。

## 復旧手順

### A. 作業コピーが消えたとき
GitHub から戻す:

```bash
git clone git@github.com:Yeongmo-Kang/PotexAdmin.git /home/ubuntu/.hermes/projects/PotexAdmin
```

または local mirror から戻す:

```bash
git clone /home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git /home/ubuntu/.hermes/projects/PotexAdmin
```

### B. GitHub が使えなくなったとき
local mirror から復旧:

```bash
git clone /home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git /home/ubuntu/.hermes/projects/PotexAdmin-restored
```

または最新 bundle から復旧:

```bash
git clone /home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/latest.bundle /home/ubuntu/.hermes/projects/PotexAdmin-restored
```

その後、新しい remote を付けて push:

```bash
cd /home/ubuntu/.hermes/projects/PotexAdmin-restored
git remote add origin <new-remote>
git push -u origin main
```

## 確認コマンド
作業コピーに登録されている remote を確認:

```bash
cd /home/ubuntu/.hermes/projects/PotexAdmin
git remote -v
```

mirror の整合性確認:

```bash
git --git-dir=/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git fsck --full --no-dangling
```

latest bundle の復元性確認:

```bash
git bundle verify /home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/latest.bundle
```

## セキュリティメモ
- `.gemini/` は local API key を含むため commit 禁止
- `generated/post_refresh_state.json` は検証用出力なので source of truth ではない
- OAuth / token / credential 類は repo 外に置き、commit しない
