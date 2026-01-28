# Team Brain Detection

## Summary

Auto-detect whether a brain has multiple committers by counting unique author emails during git status refresh. Cache the result on the Vault struct with a user override. First UI change: hide the committer name in solo brains, show it in team brains.

## Data Model

Extend the `Vault` struct with two nullable fields:

```rust
pub struct Vault {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_team: Option<bool>,          // last detected value
    pub is_team_override: Option<bool>,  // user's manual choice, null = use auto
}
```

Effective value: `is_team_override.unwrap_or(is_team.unwrap_or(false))`

Frontend mirrors this in the TypeScript `Vault` type.

## Detection

In `get_repo_status()`, add one git command:

```
git log --format='%ae' | sort -u | head -3
```

If 2+ unique emails, `is_team = true`, else `false`. The `head -3` caps output — we only need to know "more than one." Update the vault's `is_team` in settings and return it as part of `RepoStatus`.

## UI Change

In `git-status.ts` `renderStatus()`: only show `last_commit_author` when the effective `is_team` value is `true`.

## Settings Override

In the settings modal, add a per-vault toggle under the repository section: "Team repository" with three states — Auto (detected), On, Off. Maps to `is_team_override`: `null`, `true`, `false`.

## Performance

The `git log --format='%ae'` pipes through `sort -u | head -3`, so git outputs all emails but processing stops after finding 3 unique ones. On large repos this is still O(n) commits — but it runs alongside the existing git status commands, not on a hot path. If this proves slow, we can add `--max-count=500` to limit history depth.

## Future Possibilities

Once `is_team` is available, it opens the door for:

- Who column/badge on notes in the sidebar
- Conflict awareness (notes modified by others since last edit)
- Activity feed showing recent changes by others
- Different auto-commit behavior for team brains
