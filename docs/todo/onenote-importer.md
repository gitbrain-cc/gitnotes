# OneNote Importer TODOs

## Pending Features

### Image Extraction (needs thorough analysis)

Images are currently being silently dropped. Business.docx alone has 19 images including real screenshots (1248x674, 77KB).

**Questions to resolve:**
- Where to store images? `assets/` subfolder per section? Per page?
- Naming convention? `image1.png` or derive from context?
- How does mammoth expose images? `convertImage` callback exists
- Some small images may be OneNote UI icons (checkboxes?) - filter these?
- How to handle duplicate images across pages?
- What about images in notes that span multiple pages after split?

**Proposed output:**
```markdown
![](assets/page-name/image1.png)
```

### Section Metadata (.section.md)

See `docs/section-metadata-support.md` for full design.

- Slugified folder names
- `displayName` preserving original
- `order` array from creation dates

### Modified Date

NoteOne now supports `modified` in frontmatter. Could extract from:
- docx metadata?
- OneNote doesn't seem to include "last modified" in text export

### Tables

Check if any OneNote exports contain tables and if mammoth handles them.
