# Going Public Guide

Steps to publish GitNotes to `gitbrain-cc/gitnotes` when ready.

## Prerequisites

- [ ] All features for v0.1.0 complete
- [ ] App tested and working
- [ ] Landing page ready with screenshot
- [ ] README has first-launch instructions (macOS Gatekeeper bypass)

## Step 1: Create Empty Repo

On GitHub, create `gitbrain-cc/gitnotes`:
- No README, no .gitignore, no license (add via commit)
- Keep it empty

## Step 2: Prepare Clean Copy

```bash
# Create clean copy without history
cd /tmp
git clone --depth 1 file:///Users/simon/tetronomis/gitnotes gitnotes-clean
cd gitnotes-clean

# Remove git history
rm -rf .git

# Remove internal docs (plans contain local paths)
rm -rf docs/plans

# Initialize fresh repo
git init
git add -A
git commit -m "Initial commit: GitNotes v0.1.0"
```

## Step 3: Push to Public Org

```bash
git remote add origin git@github.com:gitbrain-cc/gitnotes.git
git branch -M main
git push -u origin main
```

## Step 4: Add GitHub Secrets

Go to: `https://github.com/gitbrain-cc/gitnotes/settings/secrets/actions`

Add:
- `TAURI_SIGNING_PRIVATE_KEY` - contents of `~/.tauri/gitnotes.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - `gn-updater-2026-xK9mP`

## Step 5: Update Local Dev Repo

Point your working repo to the public remote:

```bash
cd /Users/simon/tetronomis/gitnotes
git remote set-url origin git@github.com:gitbrain-cc/gitnotes.git
```

Now your local work pushes to the public repo.

## Step 6: Create First Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the release workflow. Review the draft release on GitHub and publish.

## Step 7: Enable GitHub Pages

Go to: `https://github.com/gitbrain-cc/gitnotes/settings/pages`

- Source: Deploy from branch
- Branch: `main`, folder: `/docs`
- Save

Landing page will be at: `https://gitbrain-cc.github.io/gitnotes/`

(Later: configure custom domain gitnotes.cc)

---

## After Going Public

Your workflow stays the same:
1. Develop locally in `tetronomis/gitnotes`
2. Commit and push when ready (public sees your commits)
3. Tag for releases

**Tip:** If you want to batch messy commits before pushing:
```bash
# Squash last N commits into one clean commit
git rebase -i HEAD~N
```

---

## Same Process for brain-dude

When ready to publish the brain template:
1. Create `gitbrain-cc/brain` (or similar name)
2. Follow same steps above
3. Your personal brain repo stays private
