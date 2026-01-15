# Encrypted Vaults (Future)

## Idea

Support encrypted repositories/vaults in NoteOne using **age** encryption.

## Target Audience

Coders and AI whisperers - people who already have SSH keys.

## Approach

- Use `age` Rust crate for encryption
- **Primary: SSH key support** - `age -R ~/.ssh/id_ed25519.pub` just works
- **Sharing**: encrypt to GitHub keys - `age -R github:username` (zero key exchange)
- Fallback: password-derived keys (argon2) for less technical users
- Decrypt in memory on vault open
- Encrypt on save

## Open Questions

- Granularity: whole repo vs per-folder vs per-note?
- Search: how to handle searching encrypted content?
- UX: unlock once per session? Per note?
- Git integration: how do encrypted files look in git history?

## References

- age: https://github.com/FiloSottile/age
- age Rust crate: https://crates.io/crates/age
