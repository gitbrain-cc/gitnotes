# Release Deployment Guide

Step-by-step guide for releasing a new version of GitNotes.

## Prerequisites

- All changes committed and tested locally
- GitHub Secrets configured:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Release Steps

### 1. Update Version Numbers

Edit both files to match:

**src-tauri/tauri.conf.json:**
```json
"version": "0.2.0"
```

**package.json:**
```json
"version": "0.2.0"
```

### 2. Update CHANGELOG (optional but recommended)

Add entry to `CHANGELOG.md`:
```markdown
## [0.2.0] - 2026-01-28

### Added
- New feature X

### Fixed
- Bug Y
```

### 3. Commit Version Bump

```bash
git add src-tauri/tauri.conf.json package.json CHANGELOG.md
git commit -m "chore: release v0.2.0"
```

### 4. Push Commits

```bash
git push origin master
```

### 5. Create and Push Tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

This triggers the GitHub Actions workflow.

### 6. Monitor Build

Go to: `https://github.com/gitbrain-cc/gitnotes/actions`

Watch the "Release" workflow. It will:
1. Build macOS app
2. Sign the update bundle
3. Generate `latest.json`
4. Create a **draft** release

### 7. Review Draft Release

Go to: `https://github.com/gitbrain-cc/gitnotes/releases`

The draft release will have:
- `GitNotes_0.2.0_aarch64.dmg` - installer for users
- `GitNotes.app.tar.gz` - update bundle for auto-updater
- `latest.json` - update manifest

Review the auto-generated release notes. Edit if needed.

### 8. Publish Release

Click **"Publish release"** to make it live.

Once published:
- Users can download from the releases page
- Existing installs will see the update on next launch

---

## Quick Reference

```bash
# Full release flow (after version bump is committed)
git push origin master
git tag v0.2.0
git push origin v0.2.0
```

## Troubleshooting

### Build fails with signing error

Check that GitHub Secrets are set correctly:
- `TAURI_SIGNING_PRIVATE_KEY` - full contents of `~/.tauri/gitnotes.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - the password used when generating

### latest.json not generated

Check the workflow logs. The script looks for `.tar.gz` and `.sig` files in:
```
src-tauri/target/release/bundle/macos/
```

### Users don't see update

- Verify `latest.json` is in the release assets
- Check the version in `latest.json` is higher than installed version
- The app checks for updates on startup (restart required)

---

## Version Numbering

Follow semver: `MAJOR.MINOR.PATCH`

| Change Type | Example | When |
|-------------|---------|------|
| Patch | 0.1.0 → 0.1.1 | Bug fixes only |
| Minor | 0.1.0 → 0.2.0 | New features |
| Major | 0.x → 1.0.0 | Stable release / breaking changes |

While pre-1.0, minor versions may include breaking changes.
