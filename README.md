# Webflow crossword component

This is an iframe-free crossword player. Webflow can skin it using normal CSS or by overriding the CSS custom properties at the top of `crossword.css`.

## Files

- `crossword.js`: player behavior
- `crossword.css`: default responsive theme
- `example-puzzle.json`: puzzle data example
- `webflow-embed.html`: Webflow installation snippet
- `demo.html`: local preview using inline puzzle data

## Puzzle format

Use `#` (or `.`) for blocked cells. Every solution row must be the same length. Clues are keyed by the automatically calculated clue number under `across` and `down`.

## Webflow installation

1. Upload the JavaScript, stylesheet, and puzzle JSON to a public host or CDN.
2. Add the stylesheet link to Webflow's page or site `<head>` custom code.
3. Add the crossword `<div>` with an Embed element.
4. Add the script tag before the page's closing `</body>` tag.
5. Publish the Webflow site. Custom code may not run fully inside the Designer preview.

The component also accepts inline JSON when external JSON hosting is inconvenient:

```html
<div class="crossword" data-crossword-id="demo-001">
  <script type="application/json">
    { "id": "demo-001", "title": "Demo", "solution": ["CAT","ARE","TEN"], "clues": { "across": {}, "down": {} } }
  </script>
</div>
```

## Completion event

The player emits a `crossword:complete` browser event from the crossword element. Analytics or Webflow interactions can listen for it:

```js
document.addEventListener("crossword:complete", function (event) {
  console.log("Completed puzzle", event.detail.id);
});
```

Progress is saved in `localStorage` using the puzzle ID. Changing a published puzzle without changing its ID can restore incompatible old progress, so assign a unique ID to every puzzle.
