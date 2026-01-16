# Encryption Analysis

Date: 2026-01-16

## Context

Evaluated encryption options for NoteOne vaults before committing brain repo to GitHub.

## Requirement

- Private GitHub repo
- Don't want GitHub/Microsoft to read personal notes
- Must preserve Claude Code integration (CC needs to read notes)
- Must preserve search functionality

## Options Evaluated

### 1. Encrypt at rest (age in NoteOne)

Per `future-encrypted-vaults.md` - use age Rust crate with SSH keys.

**Problems:**
- Search broken (can't index encrypted content)
- Git diffs useless (binary blobs)
- Claude Code can't read encrypted files
- Merge conflicts unresolvable

### 2. git-crypt (industry standard)

Transparent encryption via git smudge/clean filters.

```bash
brew install git-crypt
git-crypt init
echo "*.md filter=git-crypt diff=git-crypt" > .gitattributes
```

**Pros:**
- Local files decrypted → search works, CC works
- Git history encrypted → GitHub can't read
- Battle-tested (10+ years)

**Cons:**
- Uses GPG (not age) - clunky setup
- Another tool to manage

### 3. No encryption

Keep files unencrypted, rely on:
- Private GitHub repo
- Trust GitHub's access controls
- macOS FileVault for local disk encryption

## Decision

**Keep brain unencrypted for now.**

Rationale:
- Encryption adds complexity that breaks core workflows (CC, search)
- Private repo + FileVault provides reasonable security
- Can revisit if threat model changes

## Future Considerations

If encryption becomes necessary:
- git-crypt is the pragmatic choice (works today)
- age-native NoteOne encryption could be a premium feature for users who need it
