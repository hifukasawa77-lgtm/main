# Zelda Like Assets

This folder contains free game art used by `zelda_like.html`.

- Source: Kenney Roguelike/RPG pack
- URL: https://kenney.nl/assets/roguelike-rpg-pack
- Author: Kenney Vleugels for Kenney, with help by Lynn Evers
- License: Creative Commons Zero (CC0)
- License URL: https://creativecommons.org/publicdomain/zero/1.0/

The game references `Spritesheet/roguelikeSheet_transparent.png` directly from the extracted pack.

Current `zelda_like.html` uses lightweight original Canvas pixel art for the live map and keeps this imported CC0 pack available for thumbnails, reference, and future asset replacement.

## Player Sprite

- Source: Walking Character Set
- URL: https://opengameart.org/content/walking-character-set
- Author: ATMANAN
- License: Creative Commons Zero (CC0)
- License URL: https://creativecommons.org/publicdomain/zero/1.0/

`zelda_like.html` step 1 uses `player/basic_character_set/Basic Character Set/Basic Char Set Green.png` as a 4-direction, 3-frame walking spritesheet.

## GPT Image 2 Hero Sprite

- Files:
  - `player/gpt-image-2-hero-sheet-source.png` - original generated sheet with chroma-key background
  - `player/gpt-image-2-hero-sheet.png` - local transparent PNG processed from the source
- Generator: GPT Image 2
- Created: 2026-05-19
- Purpose: Original protagonist sprite sheet for `zelda_like.html`
- Layout: 4 rows by 3 columns; rows are down, left, right, up; columns are step, idle, step

Prompt summary: original top-down fantasy adventure hero sprite sheet, classic 8-bit/16-bit top-down action RPG mood, no copyrighted Zelda/Nintendo likeness, no official symbols, flat chroma-key background.

## GPT Image 2 Enemy Sprite

- Files:
  - `enemies/gpt-image-2-enemy-sheet-source.png` - original generated sheet with chroma-key background
  - `enemies/gpt-image-2-enemy-sheet.png` - local transparent PNG processed from the source
- Generator: GPT Image 2
- Created: 2026-05-19
- Purpose: Original enemy sprite sheet for `zelda_like.html`
- Layout: 5 rows by 2 columns
  - row 1: red pebble-spitter enemy, two frames
  - row 2: green forest brute, two frames
  - row 3: purple cave bat, two frames
  - row 4: blue-black crystal spider, idle/jump frames
  - row 5: tan sand worm, hidden/emerged frames

Prompt summary: original retro top-down enemy sprite sheet preserving gameplay roles from the current game, no copyrighted Zelda/Nintendo enemy likenesses, flat chroma-key background.

## GPT Image 2 Object Sprite

- Files:
  - `objects/gpt-image-2-object-sheet-source.png` - original generated sheet with chroma-key background
  - `objects/gpt-image-2-object-sheet.png` - local transparent PNG processed from the source
  - `objects/gpt-image-2-house-full-source.png` - original generated complete house object with chroma-key background
  - `objects/gpt-image-2-house-full.png` - local transparent PNG processed from the complete house source
- Generator: GPT Image 2
- Created: 2026-05-19
- Purpose: Original environment object sprite sheet for `zelda_like.html`
- Layout: 5 rows by 5 columns
  - row 1: house roof top-left, roof top-middle, roof top-right, wooden wall-left, wooden door
  - row 2: house lower-left, lower-middle, lower-right, wooden wall-right, mailbox
  - row 3: horizontal fence, vertical fence, bush, grassland blocker/tree, grassland rock
  - row 4: desert cactus, desert boulder, volcano lava-rock blocker, ember rock, snow tree
  - row 5: snow ice-rock, mountain blocker, mountain boulder, swamp dead tree, swamp log/water obstacle

Prompt summary: original retro top-down object sprite sheet for houses, fences, mailbox, trees, rocks, bushes, and biome obstacles, no copyrighted Zelda/Nintendo object likenesses, flat chroma-key background.

House correction: the first generated object sheet included house parts for compatibility with the old tile renderer. A separate complete house object was generated afterward and is now used by `zelda_like.html` as `sprites.house_full`, drawn once at 3x3 tile size.

## GPT Image 2 Terrain Sprite

- Files:
  - `terrain/gpt-image-2-terrain-sheet-source.png` - original generated terrain sheet
  - `terrain/gpt-image-2-terrain-sheet.png` - local terrain sheet used by the game
- Generator: GPT Image 2
- Created: 2026-05-19
- Purpose: Original field terrain tiles for `zelda_like.html`
- Layout: 3 rows by 3 columns
  - row 1: grassland, desert, rocky mountain
  - row 2: wetland marsh, poison swamp, river
  - row 3: wooden bridge, stone bridge/pavement, snowfield

Prompt summary: original retro top-down fantasy adventure terrain tiles in a classic 8-bit/16-bit action RPG mood, covering grassland, desert, rocky mountain, wetland, poison swamp, river, wooden bridge, stone bridge, and snowfield, with no copyrighted Zelda/Nintendo art or symbols.

## GPT Image 2 World Map Rebuild Plan (Fahren Kingdom)

- Files:
  - `world-map-fahren-badon-25x25.prompt.md` - GPT Image 2.0 prompt spec for regenerating the field map
  - `world-map-fahren-badon-25x25-layout.txt` - 25x25 logical layout draft (biome/landmark planning)
  - `world-map-fahren-25x25.png` - GPT Image 2.0 generated field map for `zelda_like.html`
- Created: 2026-05-22
- Updated: 2026-05-23
- Purpose: Recreate the Fahren Kingdom field map as a 25x25-screen realm where humans, elves, and dwarves coexist, while keeping a non-cyberpunk fantasy style.
- Integration target: output image path `assets/zelda-like/world-map-fahren-25x25.png`.

## Fahren Kingdom Field Map (25x25)

- File:
  - `world-map-fahren-badon-25x25.svg` - generated 25x25 field map art for the Fahren Kingdom invasion setting
- Created: 2026-05-22
- Purpose: In-game world map texture used by `game.html` for ZELDA QUEST field rendering.
- Notes: Original non-cyberpunk dark-fantasy look with cyan/purple accents and clear 25x25 grid readability.
