# Repo Resilience and Restore

## Goal
Keep `PotexAdmin` recoverable if either of these disappears:
- GitHub repo (`origin`)
- local working copy (`/home/ubuntu/.hermes/projects/PotexAdmin`)

## Active copies
- Primary remote: `git@github.com:Yeongmo-Kang/PotexAdmin.git`
- Working copy: `/home/ubuntu/.hermes/projects/PotexAdmin`
- Local bare mirror backup: `/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git`
- Local bundle snapshots: `/home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/`

## Automation
A scheduled host-level cron job refreshes the local mirror and verifies a restorable bundle every 6 hours.

- Cron entry: `0 */6 * * * /home/ubuntu/.hermes/scripts/potexadmin_git_resilience_backup.sh >> /home/ubuntu/.hermes/logs/potexadmin_git_backup.log 2>&1`
- Script: `~/.hermes/scripts/potexadmin_git_resilience_backup.sh`
- Backup storage permissions are intentionally restricted to the local `ubuntu` user (`700` directories, `600` files where applicable).

## Scope limits
This setup protects against these cases:
- the working copy is deleted or damaged
- GitHub is temporarily unavailable or the repo needs to be recreated from local history

This setup does **not** protect against these cases by itself:
- whole-server loss
- disk failure
- compromise of the `ubuntu` account
- loss of uncommitted or ignored local-only files

Important: the mirror and bundles preserve **committed Git history**. Uncommitted edits, ignored files, and local credentials are outside the backup guarantee.

## Restore paths

### A. If the local working copy is deleted
Restore from GitHub:

```bash
git clone git@github.com:Yeongmo-Kang/PotexAdmin.git /home/ubuntu/.hermes/projects/PotexAdmin
```

Or restore from the local mirror:

```bash
git clone /home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git /home/ubuntu/.hermes/projects/PotexAdmin
```

### B. If GitHub disappears or becomes unavailable
Restore from the local mirror:

```bash
git clone /home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git /home/ubuntu/.hermes/projects/PotexAdmin-restored
```

Or restore from the latest bundle:

```bash
git clone /home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/latest.bundle /home/ubuntu/.hermes/projects/PotexAdmin-restored
```

Then create a replacement remote and push:

```bash
cd /home/ubuntu/.hermes/projects/PotexAdmin-restored
git remote add origin <new-github-or-other-remote>
git push -u origin main
```

## Verification commands
Check the two remotes known to the working copy:

```bash
cd /home/ubuntu/.hermes/projects/PotexAdmin
git remote -v
```

Check that the local mirror is healthy:

```bash
git --git-dir=/home/ubuntu/.hermes/backups/git-mirrors/PotexAdmin.git fsck --full
```

Check that the latest bundle is restorable:

```bash
git bundle verify /home/ubuntu/.hermes/backups/git-bundles/PotexAdmin/latest.bundle
```

## Security notes
- `.gemini/` is ignored because it contains local API-key material.
- `generated/post_refresh_state.json` is ignored because it is local inspection output, not source of truth.
- OAuth/token files stay outside the repo and must never be committed.
