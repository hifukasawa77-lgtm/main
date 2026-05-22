# GPT Image 2.0 Prompt — Fahren Kingdom Field Map (25x25)

Use case: stylized-concept  
Asset type: ZELDA QUEST overworld field map (base art for a 25x25 tile map)  
Primary request: Create an original top-down fantasy field map for the Kingdom of Fahren, currently being invaded by Demon King Badon.  
Scene/backdrop: One contiguous overworld with roads and natural barriers for exploration.  
Subject: 25x25 tile-friendly world map with readable regions and landmark silhouettes.  
Style/medium: Retro 16-bit inspired top-down RPG map art, hand-painted pixel-art feel.  
Composition/framing: Perfect square image, broad regional contrast so a 25x25 logical grid can be overlaid later.  
Lighting/mood: Dark fantasy tension (invasion aftermath), still playable and readable.  
Color palette: Dark base + cyan/purple accent touches + natural greens/browns; avoid excessive neon glow.  
Materials/textures: Grassland, forest, mountain ridges, rivers, marsh, ruins, villages, royal roads, fort walls, volcanic corruption.  
Text (verbatim): none.  
Constraints: Include these landmarks clearly — royal capital of Fahren near center-west, at least 3 villages, cursed marsh in southeast, scorched volcanic scar crossing the east, and Demon King Badon’s fortress at the far northeast edge. Original art only; no Zelda/Nintendo likeness; no watermark; no UI frame.  
Avoid: cyberpunk city motifs, futuristic architecture, sci-fi neon signage, logos, text labels.

## Suggested API parameters
- model: `gpt-image-2`
- size: `1024x1024` (or `2048x2048` for higher-detail source)
- quality: `high`

## Notes for integration
- Save final selected asset as: `assets/zelda-like/world-map-fahren-badon-25x25.png`
- Keep current `assets/zelda-like/world-map.jpg` as fallback until in-game verification completes.
