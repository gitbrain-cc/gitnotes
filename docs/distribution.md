# GitNotes Distribution

Everything about releasing, updating, and supporting GitNotes.

## Release Flow

### Version Numbering

Semantic versioning: `MAJOR.MINOR.PATCH`

- **0.x.x** - Pre-1.0 releases, breaking changes allowed in minor versions
- **Patch** (0.1.1) - Bug fixes only
- **Minor** (0.2.0) - New features, may include breaking changes while pre-1.0

### Creating a Release

1. **Update version** in both files:
   ```bash
   # src-tauri/tauri.conf.json
   "version": "0.1.1"

   # package.json
   "version": "0.1.1"
   ```

2. **Update CHANGELOG.md** (create if missing):
   ```markdown
   ## [0.1.1] - 2026-01-28
   ### Fixed
   - Description of bug fix
   ```

3. **Commit and tag**:
   ```bash
   git add -A
   git commit -m "chore: release v0.1.1"
   git tag v0.1.1
   git push origin master --tags
   ```

4. **GitHub Actions** automatically:
   - Builds macOS DMG
   - Creates draft release with generated notes
   - Attaches DMG artifact

5. **Review and publish** the draft release on GitHub

### Release Checklist

- [ ] Version bumped in `tauri.conf.json` and `package.json`
- [ ] CHANGELOG.md updated
- [ ] All tests pass locally
- [ ] App builds cleanly (`npm run tauri build`)
- [ ] Quick smoke test of built app
- [ ] Tag pushed, Actions workflow succeeded
- [ ] Draft release reviewed and published
- [ ] Landing page download link updated (if version in URL)

---

## Distribution Channels

### GitHub Releases (Primary)

- URL: `https://github.com/YOUR_USERNAME/gitnotes/releases`
- Users download `.dmg` directly
- Release notes auto-generated from commits

### Landing Page

- Hosted on GitHub Pages (`docs/` folder)
- Domain: TBD (gitnotes.cc or github.io)
- Download button links to latest GitHub release
- Update download URL pattern:
  ```
  https://github.com/YOUR_USERNAME/gitnotes/releases/latest/download/GitNotes_VERSION_aarch64.dmg
  ```

---

## Code Signing

### Current Status: Ad-hoc Signing

Without an Apple Developer account ($99/year), the app uses ad-hoc signing.

**User Experience:**
1. User downloads and opens DMG
2. Drags app to Applications
3. First launch shows "app cannot be verified" warning
4. User must: System Settings > Privacy & Security > "Open Anyway"

**First-run warning mitigation:**
- Document the workaround clearly on landing page and README
- Consider adding a "First Launch" section to docs

### Future: Apple Developer Signing

When ready to invest in signing:

1. **Get Apple Developer account** ($99/year)

2. **Create certificates**:
   - Developer ID Application certificate
   - Generate via Keychain Access CSR

3. **Set up GitHub Secrets**:
   ```
   APPLE_CERTIFICATE         # Base64-encoded .p12
   APPLE_CERTIFICATE_PASSWORD
   APPLE_ID                  # Apple account email
   APPLE_PASSWORD            # App-specific password
   APPLE_TEAM_ID
   ```

4. **Update workflow** for notarization (see [Tauri macOS signing docs](https://v2.tauri.app/distribute/sign/macos/))

---

## Auto-Updates

### Architecture

```
[App] --check--> [GitHub Releases JSON] --download--> [Signed .tar.gz]
```

Uses Tauri's updater plugin with GitHub Releases as the update server.

### Setup Steps

1. **Generate signing keys**:
   ```bash
   npm run tauri signer generate -- -w ~/.tauri/gitnotes.key
   ```
   This creates:
   - `~/.tauri/gitnotes.key` (private - keep secret!)
   - `~/.tauri/gitnotes.key.pub` (public - goes in config)

2. **Add plugin to Rust**:
   ```bash
   npm run tauri add updater
   ```

3. **Configure tauri.conf.json**:
   ```json
   {
     "plugins": {
       "updater": {
         "pubkey": "CONTENTS_OF_gitnotes.key.pub",
         "endpoints": [
           "https://github.com/YOUR_USERNAME/gitnotes/releases/latest/download/latest.json"
         ]
       }
     },
     "bundle": {
       "createUpdaterArtifacts": true
     }
   }
   ```

4. **Add GitHub Secret**:
   ```
   TAURI_SIGNING_PRIVATE_KEY = contents of ~/.tauri/gitnotes.key
   TAURI_SIGNING_PRIVATE_KEY_PASSWORD = password used during generation
   ```

5. **Update GitHub Actions** to:
   - Build with signing key
   - Generate `latest.json` manifest
   - Upload `.tar.gz` update bundle alongside DMG

6. **Add update check to app** (in TypeScript):
   ```typescript
   import { check } from '@tauri-apps/plugin-updater';

   async function checkForUpdates() {
     const update = await check();
     if (update) {
       // Prompt user, then:
       await update.downloadAndInstall();
     }
   }
   ```

### Update Flow (User Perspective)

1. App checks for updates on launch (or manually via menu)
2. If update available, shows notification/dialog
3. User confirms, app downloads in background
4. On next launch, new version is active

---

## Bug Reporting

### GitHub Issues

Primary channel: `https://github.com/YOUR_USERNAME/gitnotes/issues`

### Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a bug in GitNotes
labels: bug
---

**Version:** (e.g., 0.1.0)
**OS:** (e.g., macOS 14.2)

**What happened?**

**What did you expect?**

**Steps to reproduce:**
1.
2.
3.

**Screenshots/logs** (if applicable):
```

Create `.github/ISSUE_TEMPLATE/feature_request.md`:

```markdown
---
name: Feature Request
about: Suggest an idea for GitNotes
labels: enhancement
---

**What problem does this solve?**

**Describe your ideal solution:**

**Alternatives you've considered:**
```

### In-App Feedback (Future)

Consider adding Help > Report Bug menu item that:
- Opens GitHub Issues with pre-filled template
- Includes app version automatically

---

## Roadmap

### v0.1.0 (Current)

- [x] GitHub Actions build pipeline
- [x] Draft release automation
- [ ] Landing page deployed
- [ ] Auto-updater integrated
- [ ] Issue templates created

### Future

- [ ] Apple Developer signing + notarization
- [ ] Windows build support
- [ ] Linux AppImage/Flatpak
- [ ] In-app update notifications
- [ ] Crash reporting (Sentry?)

---

## Quick Reference

| Task | Command |
|------|---------|
| Build release | `npm run tauri build` |
| Generate update keys | `npm run tauri signer generate -- -w ~/.tauri/gitnotes.key` |
| Sign update manually | `npm run tauri signer sign -k ~/.tauri/gitnotes.key target/release/bundle/...` |
| Create tag | `git tag v0.1.1 && git push origin --tags` |

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | Version, updater config |
| `.github/workflows/release.yml` | Build + release automation |
| `docs/index.html` | Landing page |
| `CHANGELOG.md` | Release history |
