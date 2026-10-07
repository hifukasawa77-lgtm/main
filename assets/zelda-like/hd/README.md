# Fahren Quest: painted HD assets and animation

This set replaces every active character, terrain, building, object, equipment icon and projectile in `zelda_like.html`.

Artwork was generated with the available image-generation tool. The tool does not expose a model-version selector; no GPT-Image2.5 model provenance is claimed. Original PNG outputs remain in the session's generated-image library. The deployed assets are WebP images embedded in self-contained SVG containers, retaining transparency and original dimensions.

## Coverage

- Hero: four directions, four walk poses per direction (16 frames).
- NPCs: man, woman, merchant, dog and chicken, four poses each (20 frames).
- All 23 regular enemies: four movement poses each, plus four hidden-worm poses (96 frames).
- All eight bosses: four movement poses each (32 frames).
- Environment objects: 20; castle objects: 15; terrain tiles: nine; equipment, projectiles and effects: 24.
- Additional directional townsperson walks: man and woman, four directions and four poses each (32 frames).
- Total: 16 atlases, 264 extracted frames. `manifest.json` records source sizes and encoded byte counts.

## Rendering and movement

The game keeps its 256×240 logical coordinates and uses a 768×720 backing canvas. Sprite buffers retain three pixels per logical unit. All atlas slices use measured row boundaries and shared row scale so walk poses do not change size between frames. Castle rows also use measured unequal column boundaries to keep neighboring gates and towers out of each sprite. Movement animation advances by actual distance travelled. Blocked characters stop walking; flying and magical creatures keep their movement cycles. Idle breathing and attack lean add subtle secondary motion. A fixed 60 Hz simulation keeps speed consistent on different refresh-rate displays. The terrain cache keeps at most 32 HD room buffers.

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

`TILE_RULES` is the collision authority. `getCastleObjects` supplies both complete building placements and tile collision footprints. Towers flank the central road; walls leave actual gate openings. Castle buildings are drawn in full, using their measured artwork bounds, without clipping against road tiles or duplicating miniature wall sprites underneath. Buildings fit within each screen and never overlap. Gardens stay beside roads. Smoothing cannot close overworld approach corridors. NPC and enemy spawn positions are moved to the nearest footprint-sized free location if their initial location is obstructed.

## Eight dungeons

The eight original boss locations are dungeon entrances. Bosses do not spawn on the overworld. Each dungeon has seven rooms: entrance → corridor → great hall → inner passage → deepest boss room; west and east side rooms branch off the corridor. All eight bosses occupy the deepest room, including Gran in D8, 黒冠の魔王城. Entrances use Space/Z or mobile/gamepad A. Leaving the entrance room through its southern doorway returns to the same field location.

Room scrolling keeps overworld coordinates fixed while inside a dungeon. The HUD changes to a seven-room dungeon map. Save version 2 records the dungeon, room and cleared rooms; version 1 overworld saves continue to load. Cleared bosses remain cleared across leaving/re-entering and save/load. The standalone `world-map.svg`/`world-map.json` mark dungeon entrances, with the boss described as being at the deepest room.

## Verification

Run `node scripts/verify-fahren-hd.cjs` (Node and Python with Pillow required).

The actual generated RGBA pixels were decoded and loaded through `graphics.js` with an instrumented Canvas API. Verification covered all 264 slices, all character animation keys, rendering all 625 field rooms and 56 dungeon rooms, connected doors, side branches, entrance interaction, deepest-room-only bosses, exit, dungeon save/load and cleared-boss persistence, solid/passable movement, bush cutting, distance-based animation, continued wing cycles, four weapon types triggering the final ending, and existing save/load behavior. This verifies game logic and asset data; it does not substitute for visual testing in an unrestricted browser.

## Townsperson gait and sword sweep

Male and female townspeople use separate four-direction walk atlases with one common scale and foot baseline across directions. A four-pose cycle covers 24 logical pixels; motion accelerates and decelerates over ten ticks. Walks preserve their facing when stopped and cannot leave the current screen. Breathing deformation is suppressed while walking.

The sword attack lasts 24 simulation ticks (0.4 seconds), including wind-up and recovery. The blade rotates through a 143-degree arc with a short trail and torso follow-through. A swept blade hitbox follows the rendered angle during the active phase only; wind-up and recovery do not deal damage.
