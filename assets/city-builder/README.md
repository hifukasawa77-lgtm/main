# CITY BUILDER Assets

Generated with the built-in GPT-image2 workflow on 2026-05-27.

- `sheets/`: original generated sprite sheets kept as source assets.
- `tiles/`: 128x128 tile PNGs sliced from the generated sheets.
- `sprites/`: transparent PNG overlays sliced from the chroma-key vehicle/effect sheet.

Runtime usage is wired in `city.html`. The game draws these images first and falls back to the previous Canvas vector drawing if an image is unavailable.
