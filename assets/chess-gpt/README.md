# Chess AI GPT-image2 Assets

Generated with the built-in GPT-image2 workflow on 2026-06-01.

- `chess-board-gpt-image-2.png`: full board texture used by `chess.html`.
- `chess-pieces-atlas-source.png`: original generated chroma-key piece atlas.
- `chess-pieces-atlas-alpha.png`: locally chroma-keyed transparent atlas.
- `pieces/*.png`: individual transparent piece sprites sliced from the atlas.
- `chess-thumb-gpt-image-2.png`: portfolio thumbnail composed from the generated board and pieces.

Runtime usage is wired in `chess.html`. Piece sprites load first and the page falls back to the original Unicode glyphs if any sprite fails.
