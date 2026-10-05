# Fahren Quest: painted HD assets and animation

This set replaces every active character, terrain, building, object, equipment icon and projectile in `zelda_like.html`.

Artwork was generated with the available image-generation tool. The tool does not expose a model-version selector; no GPT-Image2.5 model provenance is claimed. Original PNG outputs remain in the session's generated-image library. The deployed assets are WebP images embedded in self-contained SVG containers, retaining transparency and original dimensions.

## Coverage

- Hero: four directions, four walk poses per direction (16 frames).
- NPCs: man, woman, merchant, dog and chicken, four poses each (20 frames).
- All 23 regular enemies: four movement poses each, plus four hidden-worm poses (96 frames).
- All eight bosses: four movement poses each (32 frames).
- Environment objects: 20; castle objects: 15; terrain tiles: nine; equipment, projectiles and effects: 24.
- Total: 14 atlases, 232 extracted frames. `manifest.json` records source sizes and encoded byte counts.

## Rendering and movement

The game keeps its 256×240 logical coordinates and uses a 768×720 backing canvas. Sprite buffers retain three pixels per logical unit. All atlas slices use measured row boundaries and shared row scale so walk poses do not change size between frames. Movement animation advances by actual distance travelled. Blocked characters stop walking; flying and magical creatures keep their movement cycles. Idle breathing and attack lean add subtle secondary motion. A fixed 60 Hz simulation keeps speed consistent on different refresh-rate displays.

## Passage rules

| Object or terrain | Passage |
| --- | --- |
| Ground, roads, bridges, plazas, stairs | Walkable |
| Flowers, small pebbles, short grass | Walkable |
| Shallow mud | Walkable, movement slowed |
| Walls, trees, rocks, houses and closed doors | Blocked |
| Deep water, fences, mailbox | Blocked |
| Bushes | Blocked until cut with the sword |
| Open castle gate | Central passage stays walkable |

`TILE_RULES` is the collision authority. Castle artwork is clipped to corresponding solid or walkable tiles so art does not cover a traversable corridor. NPC and enemy spawn positions are moved to the nearest footprint-sized free location if their initial location is obstructed.

## Verification

Run `node scripts/verify-fahren-hd.cjs` (Node and Python with Pillow required).

The actual generated RGBA pixels were decoded and loaded through `graphics.js` with an instrumented Canvas API. Verification covered all 232 slices, all character animation keys, rendering all 625 rooms, solid/passable movement, bush cutting, distance-based animation, continued wing cycles, four weapon types triggering the final ending, and existing save/load behavior. This verifies game logic and asset data; it does not substitute for visual testing in an unrestricted browser.
