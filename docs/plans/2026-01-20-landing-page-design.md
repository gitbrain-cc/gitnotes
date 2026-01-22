# GitNotes Landing Page Design

Single-page landing for GitNotes public launch. Focus: get downloads + showcase product.

## Tech Stack

- Single HTML file (`docs/index.html`)
- GitHub Pages (enable on `docs/` folder)
- No build step, no framework

## Structure

### Hero (100vh)

**Background:** Dark gradient (#0a0a0a → #1a1a1a)

**Content (centered, stacked):**
1. Tagline: "Git-native markdown notes for developers who think in plain text" (~18px, muted)
2. Headline: "GitNotes" (~72px, bold, white)
3. CTA: "Download for Mac" button (amber #f59e0b)
4. Version: "v0.1.0 · macOS · Open Source" (~14px, very muted)

**3D Screenshot:**
- App screenshot below CTA
- CSS transform: `perspective(1000px) rotateX(10deg) rotateY(-5deg)`
- Large drop shadow, subtle amber glow behind
- ~60% viewport width

### Features (4-grid)

Dark background continues. Max-width 1000px container.

| # | Icon | Headline | Description |
|---|------|----------|-------------|
| 1 | Bot/terminal | "Your AI can read your notes" | "Plain markdown in git. Claude Code, Cursor, any agent has full access." |
| 2 | Git branch | "History without thinking" | "Auto-commits, visual diffs, branch support. Notes that time-travel." |
| 3 | Search | "Find anything instantly" | "Full-text search across all notes. Cmd+P and go." |
| 4 | Unlock | "Just files, forever" | "Markdown files in folders. Open with any editor, sync with any git host." |

Layout: 2x2 grid on desktop, 1 column on mobile.

### Footer

Single row, minimal:
- Left: "GitNotes · MIT License"
- Right: "GitHub · Releases · @simonortet"

## Assets Needed

- `screenshot.png` - App screenshot (will apply CSS 3D transform)
- SVG icons for features (inline)

## Domain

TBD - possibly gitnotes.cc or use github.io initially
