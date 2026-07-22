# Kehlani Crossword for Webflow

This package does not require Webflow CMS.

## Files to upload to GitHub

- `crossword.js`
- `crossword.css`
- `kehlani-setlist-puzzle.json`

Upload all three files to the root of the public `WadaStudio/webflow-crosswords` repository and confirm GitHub Pages is enabled.

## Webflow Head code

Add this under **Site settings → Custom code → Head code**:

```html
<link
  rel="stylesheet"
  href="https://wadastudio.github.io/webflow-crosswords/crossword.css">
```

## Webflow Footer code

Add this under **Site settings → Custom code → Footer code**:

```html
<script
  src="https://wadastudio.github.io/webflow-crosswords/crossword.js"
  defer>
</script>
```

## Webflow page embed

Add a Code Embed element to the static Webflow page and paste:

```html
<div
  class="crossword"
  data-crossword-id="kehlani-setlist-001"
  data-crossword-src="https://wadastudio.github.io/webflow-crosswords/kehlani-setlist-puzzle.json">
</div>
```

Publish the Webflow site to test the crossword. Scripts may not render completely on the Designer canvas.

## Updating the puzzle

Edit `kehlani-setlist-puzzle.json` and commit it to GitHub. Keep its `id` unchanged for minor clue edits. If the solution grid changes after visitors may have saved progress, assign a new unique `id` and update `data-crossword-id` in the Webflow embed.
