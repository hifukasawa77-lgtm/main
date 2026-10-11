/* Full-resolution painted assets; all dimensions below use logical game units. */
window.FahrenVisuals = (() => {
    const ROOT = 'assets/zelda-like/hd/', SCALE = 3;
    const sheets = [
        {file:'hero-motion.svg',cols:4,rows:4,size:28,groups:['hero_down','hero_left','hero_right','hero_up']},
        {file:'npc-motion.svg',cols:4,rows:5,size:26,groups:['npc_man','npc_woman','merchant','npc_dog','npc_chicken'],sizes:[26,26,26,21,17]},
        {file:'npc-man-walk.svg',cols:4,rows:4,size:26,uniformScale:true,groups:['npc_man_down','npc_man_left','npc_man_right','npc_man_up']},
        {file:'npc-woman-walk.svg',cols:4,rows:4,size:26,uniformScale:true,groups:['npc_woman_down','npc_woman_left','npc_woman_right','npc_woman_up']},
        {file:'enemy-motion-a.svg',cols:4,rows:4,size:26,groups:['stone_shooter','goblin_warrior','bat','spider']},
        {file:'enemy-motion-b.svg',cols:4,rows:4,size:26,groups:['worm_emerge','slime','boar','goblin_spear']},
        {file:'enemy-motion-c.svg',cols:4,rows:4,size:26,groups:['forest_wisp','leaf_beetle','river_toad','desert_scarab']},
        {file:'enemy-motion-d.svg',cols:4,rows:4,size:26,groups:['sand_bandit','cactus_mimic','scorpion','dust_skull']},
        {file:'enemy-motion-e.svg',cols:4,rows:4,size:26,groups:['dune_serpent','lava_sprite','magma_hound','ash_gargoyle']},
        {file:'enemy-motion-f.svg',cols:4,rows:4,size:26,groups:['crystal_golem','swamp_leech','bog_witch','worm_hidden']},
        {file:'boss-motion-a.svg',cols:4,rows:4,size:50,groups:['boss_forest','boss_desert','boss_lake','boss_swamp']},
        {file:'boss-motion-b.svg',cols:4,rows:4,size:50,groups:['boss_mountain','boss_volcano','boss_sanctuary','boss_gran']},
        {file:'objects.svg',cols:5,rows:4,size:16,names:[
            'house_full','fence_h','fence_v','mailbox','bush',
            'wall_grassland','obs_grassland','wall_desert','obs_desert','wall_volcano',
            'obs_volcano','wall_snow','obs_snow','wall_mountain','obs_mountain',
            'wall_swamp','obs_swamp','wall_town','flowers','pebbles'
        ],sizes:{house_full:48}},
        {file:'castle.svg',cols:5,rows:3,size:64,names:[
            'castle_gateClosed','castle_gateOpen','castle_towerLarge','castle_towerTall','castle_towerSmall',
            'castle_wallBanner','castle_wallWide','castle_wallBroken','castle_battlement','castle_stairs',
            'castle_plaza','castle_stoneTile','castle_drawbridge','castle_bridgeNarrow','castle_bannerTall'
        ]},
        {file:'terrain.svg',cols:3,rows:3,size:16,terrain:true,names:[
            'terrain_grassland','terrain_desert','terrain_mountain',
            'terrain_wetland','terrain_poison_swamp','terrain_river',
            'terrain_wood_bridge','terrain_stone_bridge','terrain_snowfield'
        ]},
        {file:'items.svg',cols:6,rows:4,size:16,names:[
            'heart','heart_half','heart_empty','coin','ico_bomb','ico_bow',
            'proj_arrow_up','proj_arrow_down','proj_arrow_left','proj_arrow_right','ico_potion','ico_candle',
            'ico_shield','ico_clothes','ico_armor','ico_key','sword_up','sword_down',
            'sword_left','sword_right','proj_fire','rock_proj','falling_rock','bomb_flash'
        ]}
    ];

    // Measured row boundaries retain full bodies in generated sheets with unequal margins.
    const rowCuts = {
        'hero-motion.svg':[0,.2377,.46706,.70058,1],
        'npc-motion.svg':[0,.24536,.47932,.704,.84451,1],
        'enemy-motion-a.svg':[0,.25599,.49724,.71547,1],
        'enemy-motion-b.svg':[0,.28125,.50781,.72363,1],
        'enemy-motion-c.svg':[0,.25879,.50195,.74414,1],
        'enemy-motion-d.svg':[0,.2477,.48435,.73757,1],
        'enemy-motion-e.svg':[0,.24599,.50267,.72193,1],
        'enemy-motion-f.svg':[0,.30859,.51367,.79688,1],
        'boss-motion-a.svg':[0,.24242,.49822,.72906,1],
        'boss-motion-b.svg':[0,.24609,.47754,.71777,1],
        'objects.svg':[0,.26381,.52228,.77094,1],
        'castle.svg':[0,.38281,.62598,1],
        'items.svg':[0,.25684,.5,.75,1]
    };
    sheets.forEach(sheet => { sheet.rowCuts = rowCuts[sheet.file]; });
    // The castle sheet has unequal object widths, especially its two gates.
    const columnCuts = {
        'castle.svg':[
            [0,414/1536,798/1536,1060/1536,1280/1536,1],
            [0,317/1536,715/1536,1005/1536,1300/1536,1],
            [0,365/1536,707/1536,1000/1536,1260/1536,1]
        ]
    };

    function imageAt(path) {
        return new Promise((resolve,reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Image could not load: ' + path));
            image.src = path;
        });
    }

    function bounds(image, x, y, w, h, terrain) {
        if (terrain) return {x:x+1,y:y+1,w:w-2,h:h-2};
        const scratch = document.createElement('canvas');
        scratch.width = Math.ceil(w); scratch.height = Math.ceil(h);
        const context = scratch.getContext('2d', {willReadFrequently:true});
        context.drawImage(image,x,y,w,h,0,0,scratch.width,scratch.height);
        const pixels = context.getImageData(0,0,scratch.width,scratch.height).data;
        let left=scratch.width,top=scratch.height,right=-1,bottom=-1;
        for(let py=0;py<scratch.height;py++) for(let px=0;px<scratch.width;px++) {
            if (pixels[(py*scratch.width+px)*4+3]>32) {
                left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
            }
        }
        if(right<left) throw new Error('Empty sprite cell');
        return {x:x+left,y:y+top,w:right-left+1,h:bottom-top+1};
    }

    function frame(image, rect, size, scale) {
        const surface = document.createElement('canvas');
        surface.width = surface.height = size*SCALE;
        const context=surface.getContext('2d');
        context.imageSmoothingEnabled=true;
        context.imageSmoothingQuality='high';
        const width=rect.w*scale*SCALE,height=rect.h*scale*SCALE;
        context.drawImage(image,rect.x,rect.y,rect.w,rect.h,(surface.width-width)/2,surface.height-height-SCALE,width,height);
        return {image:surface,width:size,height:size,
            contentBounds:{x:(surface.width-width)/2,y:surface.height-height-SCALE,w:width,h:height}};
    }

    async function loadSheet(spec, sprites) {
        const image=await imageAt(ROOT+spec.file);
        const w=image.naturalWidth/spec.cols;
        const rowRects=[];
        for(let row=0;row<spec.rows;row++) {
            const y=(spec.rowCuts?.[row] ?? row/spec.rows)*image.naturalHeight;
            const bottom=(spec.rowCuts?.[row+1] ?? (row+1)/spec.rows)*image.naturalHeight;
            const cuts=columnCuts[spec.file]?.[row];
            const rects=Array.from({length:spec.cols},(_,col)=>{
                const left=cuts?cuts[col]*image.naturalWidth:col*w;
                const right=cuts?cuts[col+1]*image.naturalWidth:(col+1)*w;
                return bounds(image,left,y,right-left,bottom-y,spec.terrain);
            });
            rowRects.push(rects);
        }
        for(let row=0;row<spec.rows;row++) {
            const rects=rowRects[row];
            const scaleRects=spec.uniformScale?rowRects.flat():rects;
            const sharedScale=spec.groups ? Math.min((spec.size-2)/Math.max(...scaleRects.map(r=>r.w)),(spec.size-2)/Math.max(...scaleRects.map(r=>r.h))) : null;
            for(let col=0;col<spec.cols;col++) {
                const name=spec.groups ? spec.groups[row]+'_'+(col+1) : spec.names[row*spec.cols+col];
                const size=spec.groups ? (spec.sizes?.[row]||spec.size) : (spec.sizes?.[name]||spec.size);
                const rect=rects[col];
                if(spec.terrain) {
                    const surface=document.createElement('canvas'); surface.width=surface.height=size*SCALE;
                    surface.getContext('2d').drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,surface.width,surface.height);
                    sprites[name]={image:surface,width:size,height:size};
                } else {
                    const scale=sharedScale ? sharedScale*(size-2)/(spec.size-2) : Math.min((size-1)/rect.w,(size-1)/rect.h);
                    sprites[name]=frame(image,rect,size,scale);
                }
            }
        }
    }

    async function load(sprites) {
        await Promise.all(sheets.map(spec=>loadSheet(spec,sprites)));
        sprites.npc_dog=sprites.npc_dog_1; sprites.npc_chicken=sprites.npc_chicken_1;
        sprites.merchant=sprites.merchant_1;
        sprites.worm_hidden=sprites.worm_hidden_1; sprites.worm_emerge=sprites.worm_emerge_1;
        sprites.ground_town=sprites.terrain_stone_bridge;
        sprites.ground_swamp=sprites.terrain_wetland; sprites.mud_swamp=sprites.terrain_poison_swamp;
        sprites.ico_arrow=sprites.proj_arrow_up; sprites.bomb_entity=sprites.ico_bomb;
    }

    function draw(context,sprite,x,y,w,h) {
        if(!sprite) return;
        context.drawImage(sprite.image||sprite,x,y,w??sprite.width,h??sprite.height);
    }
    function drawObject(context,sprite,x,y,w,h) {
        if(!sprite)return;
        const bounds=sprite.contentBounds;
        if(bounds)context.drawImage(sprite.image,bounds.x,bounds.y,bounds.w,bounds.h,x,y,w,h);
        else draw(context,sprite,x,y,w,h);
    }
    return {load,draw,drawObject,sheets};
})();
const FahrenVisuals = window.FahrenVisuals;
