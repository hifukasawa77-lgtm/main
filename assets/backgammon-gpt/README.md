# Backgammon GPT-image2 Assets

Generated with the built-in GPT-image2 workflow on 2026-06-01.

- `backgammon-board-gpt-image-2.png`: runtime board background for `backgammon.html`, resized to the 880x590 canvas.
- `backgammon-board-source.png`: original generated board image.
- `backgammon-pieces-dice-atlas-source.png`: original generated chroma-key atlas.
- `backgammon-pieces-dice-atlas-alpha.png`: locally chroma-keyed transparent atlas.
- `pieces/*.png`: normalized transparent checker and dice sprites sliced from the atlas.
- `backgammon-thumb-gpt-image-2.png`: homepage thumbnail composed from the generated board, checkers, and dice.

Runtime usage is wired in `backgammon.html`. The game loads these assets first and falls back to the previous Canvas drawing if an image fails.
