# Editor

NoteOne uses a markdown editor with live preview.

## Live Preview

Markdown formatting renders inline as you type:

| Syntax | Result |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |
| `# Heading` | Large heading |

**How it works:**
- Syntax markers (`**`, `*`, `` ` ``, `#`) are hidden when cursor is away
- Move cursor to a line to reveal its raw markdown
- Text remains fully editable

This gives you a clean reading experience while keeping source accessible.

## Auto-Save

Changes save automatically with a 500ms debounce. The status bar shows:
- "Modified..." while waiting
- "Saved" when complete

## Syntax Highlighting

Even in raw markdown mode, formatting is styled:
- Headers are larger and bold
- Bold text appears bold
- Italic text appears italic
- Links are blue and underlined
