# Release Deployment Guide

Step-by-step guide for releasing a new version of GitNotes.

## Prerequisites

- All changes committed and tested locally
- Code pushed to both remotes (`origin` and `gitbrain`)
- GitHub Secrets configured on `gitbrain-cc/gitnotes`:
  - `APPLE_CERTIFICATE` - base64-encoded .p12 Developer ID certificate
  - `APPLE_CERTIFICATE_PASSWORD` - password for the .p12 file
  - `APPLE_ID` - Apple ID email for notarization
  - `APPLE_PASSWORD` - app-specific password for notarization
  - `APPLE_TEAM_ID` - Apple Developer Team ID
  - `TAURI_SIGNING_PRIVATE_KEY` - full contents of `~/.tauri/gitnotes.key`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - the password used when generating

## Remotes

| Remote | Repo | Purpose |
|--------|------|---------|
| `origin` | `tetronomis/gitnotes` | Private, source of truth |
| `gitbrain` | `gitbrain-cc/gitnotes` | Public, releases + Actions |

Tags must be pushed to `gitbrain` to trigger the release workflow.

## Release Steps

### 1. Update Version Numbers

Update version in **all three files**:

- `package.json` → `"version": "X.Y.Z"`
- `src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `src-tauri/Cargo.toml` → `version = "X.Y.Z"`

### 2. Commit and Push

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "vX.Y.Z — Short description"
git push origin master
git push gitbrain master
```

### 3. Create and Push Tag

```bash
git tag vX.Y.Z
git push gitbrain vX.Y.Z
```

This triggers the GitHub Actions release workflow.

### 4. Monitor Build

```bash
gh run list --repo gitbrain-cc/gitnotes --limit 1
gh run watch <run-id> --repo gitbrain-cc/gitnotes
```

Or go to: https://github.com/gitbrain-cc/gitnotes/actions

The workflow will:
1. Build the macOS app (Apple Silicon + Intel universal via Rosetta)
2. Sign with Developer ID certificate
3. Notarize with Apple
4. Generate `latest.json` update manifest
5. Create a **draft** release

### 5. Review and Publish

Go to: https://github.com/gitbrain-cc/gitnotes/releases

The draft release will have:
- `GitNotes_X.Y.Z_aarch64.dmg` — installer for users
- `GitNotes.app.tar.gz` — signed update bundle for auto-updater
- `latest.json` — update manifest with signature

Review the auto-generated release notes, edit if needed, then click **"Publish release"**.

Once published:
- Users can download the `.dmg` from the releases page
- Existing installs will see the update on next launch (auto-updater checks `latest.json`)

---

## Quick Reference

```bash
# Full release flow
git push origin master && git push gitbrain master
git tag vX.Y.Z
git push gitbrain vX.Y.Z
# Monitor: gh run watch <id> --repo gitbrain-cc/gitnotes
# Publish: https://github.com/gitbrain-cc/gitnotes/releases
```

## Troubleshooting

### Build fails with signing error

Check GitHub Secrets on `gitbrain-cc/gitnotes`:
- `APPLE_CERTIFICATE` — must be base64 of the .p12 file
- `APPLE_CERTIFICATE_PASSWORD` — must match the .p12 export password
- Signing identity in workflow: `Developer ID Application: Simon Ortet (C2DSGP8SBQ)`

### Build fails with notarization error

- `APPLE_ID` — Apple ID email
- `APPLE_PASSWORD` — must be an **app-specific password** (not account password)
- `APPLE_TEAM_ID` — team ID matching the certificate

### latest.json not generated

Check the workflow logs. The script looks for `.tar.gz` and `.sig` files in:
```
src-tauri/target/release/bundle/macos/
```

### Users don't see update

- Verify `latest.json` is in the release assets
- Check the version in `latest.json` is higher than installed version
- The app checks for updates on startup (restart required)
- Updater endpoint: `https://github.com/gitbrain-cc/gitnotes/releases/latest/download/latest.json`

---

## Version Numbering

Follow semver: `MAJOR.MINOR.PATCH`

| Change Type | Example | When |
|-------------|---------|------|
| Patch | 0.2.0 → 0.2.1 | Bug fixes only |
| Minor | 0.2.0 → 0.3.0 | New features |
| Major | 0.x → 1.0.0 | Stable release / breaking changes |

While pre-1.0, minor versions may include breaking changes.
