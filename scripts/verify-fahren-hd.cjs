const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..')+path.sep;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'fahren-hd-'));
const decoded=spawnSync('python',['-c',"from pathlib import Path\nfrom PIL import Image\nfrom io import BytesIO\nimport base64,re,json,sys\nroot=Path(sys.argv[1]); scratch=Path(sys.argv[2])\nfor item in json.loads((root/'assets/zelda-like/hd/manifest.json').read_text())['assets']:\n    svg=(root/'assets/zelda-like/hd'/item['file']).read_text()\n    payload=re.search(r'data:image/webp;base64,([^\"]+)',svg)[1]\n    image=Image.open(BytesIO(base64.b64decode(payload))).convert('RGBA')\n    assert image.size == (item['width'],item['height']), item['file']\n    (scratch/(item['file'].replace('.svg','')+'.rgba')).write_bytes(image.tobytes())\n",root,scratch],{encoding:'utf8'});
if(decoded.status!==0){fs.rmSync(scratch,{recursive:true,force:true});throw new Error('Python with Pillow is required to decode atlas pixels: '+decoded.stderr);}
const manifest=JSON.parse(fs.readFileSync(root+'assets/zelda-like/hd/manifest.json'));
const atlases=new Map(manifest.assets.map(a=>[a.file,{...a,pixels:fs.readFileSync(path.join(scratch,a.file.replace('.svg','')+'.rgba'))}]));
const calls=[],texts=[];
function context(canvas) {
    const obj={canvas,fillText(text){texts.push(text)},createLinearGradient(){return {addColorStop(){}}},
        drawImage(image,...args){
            assert(image,'Missing draw image');
            assert(args.every(Number.isFinite),'Non-finite draw dimensions');
            this.last={image,args};calls.push({image,args});
        },
        getImageData(x,y,w,h){
            const {image,args}=this.last;
            const [sx,sy,sw,sh]=args;
            const data=new Uint8ClampedArray(w*h*4);
            for(let py=0;py<h;py++) for(let px=0;px<w;px++) {
                const ix=Math.min(image.naturalWidth-1,Math.max(0,Math.floor(sx+px/w*sw)));
                const iy=Math.min(image.naturalHeight-1,Math.max(0,Math.floor(sy+py/h*sh)));
                const offset=(iy*image.naturalWidth+ix)*4;
                data.set(image.pixels.subarray(offset,offset+4),(py*w+px)*4);
            }
            return {data};
        }
    };
    return new Proxy(obj,{get:(o,key)=>o[key]??(()=>{})});
}
function element(){const e={width:768,height:720,textContent:'',addEventListener(){}};e.context=context(e);e.getContext=()=>e.context;return e;}
class Image {
    set src(value){
        this._src=value;
        const a=atlases.get(value.split('/').pop());
        if(a){this.naturalWidth=this.width=a.width;this.naturalHeight=this.height=a.height;this.pixels=a.pixels;queueMicrotask(()=>this.onload?.());}
    }
}
const storage=new Map();
let raf;
const sandbox={console,assert,Math:Object.create(Math),Date,Image,performance:{now:()=>1000},
    document:{getElementById:element,createElement:element},window:{addEventListener(){}},navigator:{},
    requestAnimationFrame(fn){raf=fn},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(root+'assets/zelda-like/hd/graphics.js','utf8'),sandbox);
const html=fs.readFileSync(root+'zelda_like.html','utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
    // Drain the actual async atlas loader, using the generated artwork's decoded pixels.
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(run('graphicsReady'),true);
    assert.equal(run('canvas.width'),768);assert.equal(run('canvas.height'),720);
    assert.equal(run('FahrenVisuals.sheets.length'),16);
    assert.equal(run('FahrenVisuals.sheets.reduce((n,s)=>n+s.cols*s.rows,0)'),264);
    assert(run('["man","woman"].every(type=>["up","down","left","right"].every(dir=>[1,2,3,4].every(n=>sprites[`npc_${type}_${dir}_${n}`])))'));
    assert(run('Object.keys(ENEMY_PROFILES).every(type => type === "worm" ? [1,2,3,4].every(n=>sprites[`worm_emerge_${n}`]&&sprites[`worm_hidden_${n}`]) : [1,2,3,4].every(n=>sprites[`${type}_${n}`]))'));
    assert(run('sprites.hero_down_1.image.width===84 && sprites.boss_gran_4.image.width===150'));
    console.log('PASS all 264 generated frames loaded, directional townspeople, every enemy/boss covered, HD backing resolution');
    run('startNewGame();');
    // Render all 625 rooms, all species and all four animation frames.
    run(`for(let y=WORLD_MIN;y<=WORLD_MAX;y++) for(let x=WORLD_MIN;x<=WORLD_MAX;x++) {
        currentRoomX=x;currentRoomY=y;const room=getRoom(x,y);drawRoom(room,0,0);
        for(const actor of [...(room.enemies||[]),...(room.npcs||[])]) for(let f=1;f<=4;f++){actor.animFrame=f;actor.draw();}
    }`);
    console.log('PASS all 625 rooms and actor animation frames render without missing/non-finite images');
    run(`{
        for(let y=WORLD_MIN;y<=WORLD_MAX;y++)for(let x=WORLD_MIN;x<=WORLD_MAX;x++){
            const room=getWorldRoom(x,y),tiles=room.tiles;
            const reachable=new Set(['8,8']),queue=[[8,8]];
            assert(!isSolid(tiles[8][8]),'Room approach must be clear');
            while(queue.length){const [c,r]=queue.shift();for(const [dc,dr] of [[0,1],[0,-1],[1,0],[-1,0]]){
                const nc=c+dc,nr=r+dr,id=nc+','+nr;
                if(nc<0||nr<0||nc>=SCREEN_COLS||nr>=SCREEN_ROWS||reachable.has(id)||isSolid(tiles[nr][nc]))continue;
                reachable.add(id);queue.push([nc,nr]);
            }}
            for(let r=0;r<SCREEN_ROWS;r++)for(let c=0;c<SCREEN_COLS;c++){
                if((r===0||r===SCREEN_ROWS-1||c===0||c===SCREEN_COLS-1)&&!isSolid(tiles[r][c]))
                    assert(reachable.has(c+','+r),'Object placement disconnects exit '+x+','+y+' '+c+','+r);
            }
            if(isCastleRoom(x,y)){
                const occupied=new Set();
                for(const object of getCastleObjects(x,y)){
                    assert(object.c>=0&&object.r>=0&&object.c+object.w<=SCREEN_COLS&&object.r+object.h<=SCREEN_ROWS,'Complete building must fit screen');
                    for(let r=object.r;r<object.r+object.h;r++)for(let c=object.c;c<object.c+object.w;c++){
                        const id=c+','+r;assert(!occupied.has(id),'Castle objects overlap');occupied.add(id);
                        assert(isSolid(tiles[r][c]),'Complete building footprint must block passage');
                    }
                }
                for(let r=0;r<SCREEN_ROWS;r++)for(let c=0;c<SCREEN_COLS;c++)if(tiles[r][c]===1)
                    assert(occupied.has(c+','+r),'No orphan miniature wall objects');
            }
        }
    }`);
    if(process.env.FAHREN_PLACEMENT_PREVIEW)fs.writeFileSync(process.env.FAHREN_PLACEMENT_PREVIEW,run('JSON.stringify({tiles:getWorldRoom(START_ROOM_X,START_ROOM_Y).tiles,objects:getCastleObjects(START_ROOM_X,START_ROOM_Y)})'));
    console.log('PASS all 625 room exits connected; castle buildings fit screens without overlap, clipped corridors or orphan walls');
    assert(run('terrainLayerCache.size<=32'),'HD room cache must stay bounded');
    for(const tile of [0,3,4,5,6]) assert.equal(run(`isSolid(${tile})`),false);
    for(const tile of [1,2,20,21,22,23,24,25,26,27,28,40,41,42,43,999]) assert.equal(run(`isSolid(${tile})`),true);
    run(`startNewGame(); const passageRoom=getRoom(currentRoomX,currentRoomY);
        passageRoom.tiles=Array.from({length:SCREEN_ROWS},()=>Array(SCREEN_COLS).fill(0));
        passageRoom.tiles[3][4]=1;player.x=4*TILE;player.y=4*TILE;keys.KeyW=true;`);
    const initial=run('player.y');run('for(let n=0;n<20;n++)player.update();');
    assert.equal(run('player.y'),initial);assert.equal(run('player.animFrame'),1,'Blocked player must not walk');
    run('passageRoom.tiles[3][4]=5;for(let n=0;n<4;n++)player.update();');
    assert(run('player.y')<initial,'Flowers are walkable');
    run('keys.KeyW=false;passageRoom.tiles[3][4]=43;player.isAttacking=true;player.attackTimer=12;player.swordHitbox={x:64,y:48,w:16,h:16}; updatePlaying();');
    assert.equal(run('passageRoom.tiles[3][4]'),0);assert.equal(run('isSolid(passageRoom.tiles[3][4])'),false);
    console.log('PASS solid/passable terrain, wall stop, flowers, cuttable bushes');
    run('const gait={animFrame:1,animTimer:0,baseSpeed:1.5};const seen=new Set();for(let i=0;i<32;i++){advanceWalk(gait,1.5);seen.add(gait.animFrame);}');
    assert.equal(run('seen.size'),4);run('advanceWalk(gait,0);');assert.equal(run('gait.animFrame'),1);
    run('const wing={animFrame:1,animTimer:0};const wings=new Set();for(let i=0;i<30;i++){advanceWalk(wing,0,true);wings.add(wing.animFrame);}');
    assert.equal(run('wings.size'),4);
    console.log('PASS four-frame gait, stopped idle, continuous wing/spirit animation');
    run(`{
        startNewGame();const room=getRoom(currentRoomX,currentRoomY);
        room.tiles=Array.from({length:SCREEN_ROWS},()=>Array(SCREEN_COLS).fill(0));room.npcs=[];
        keys.KeyW=false;keys.KeyA=false;keys.KeyS=false;keys.KeyD=false;
        const walker=new NPC(80,100,currentRoomX,currentRoomY,'man','test');
        walker.timer=1000;walker.dx=0.5;
        const frames=new Set(),velocities=[];
        for(let n=0;n<60;n++){walker.update();frames.add(walker.animFrame);velocities.push(walker.velocityX);walker.draw();}
        assert.equal(walker.dir,'right');assert.equal(frames.size,4);
        assert(velocities[0]>0&&velocities[0]<velocities[9],'Smooth acceleration');
        walker.dx=0;for(let n=0;n<12;n++)walker.update();
        assert.equal(walker.animFrame,1);assert(Math.abs(walker.velocityX)<0.001);
        walker.dx=-0.5;for(let n=0;n<20;n++)walker.update();assert.equal(walker.dir,'left');
        walker.dx=0;walker.dy=-0.5;for(let n=0;n<20;n++)walker.update();assert.equal(walker.dir,'up');
        walker.dy=0.5;for(let n=0;n<25;n++)walker.update();assert.equal(walker.dir,'down');
        walker.x=0;walker.dx=-0.5;walker.dy=0;walker.velocityX=-0.5;walker.velocityY=0;
        walker.update();assert.equal(walker.x,0);assert.equal(walker.dx,0);
        for(const dir of ['up','down','left','right']){
            player.x=100;player.y=100;player.dir=dir;player.isAttacking=false;
            keyPress.Space=true;player.update();assert.equal(player.attackTimer,SWORD_ATTACK_FRAMES);
            assert.equal(player.swordHitbox,null,'Wind-up does not deal damage');
            const tips=[], facing={up:-Math.PI/2,down:Math.PI/2,left:Math.PI,right:0}[dir];
            const origin=getSwordPose(player),front={x:origin.x+Math.cos(facing)*20-3,y:origin.y+Math.sin(facing)*20-3,w:6,h:6};
            const behind={x:origin.x-Math.cos(facing)*20-3,y:origin.y-Math.sin(facing)*20-3,w:6,h:6};
            let hitFront=false;
            for(let n=0;n<SWORD_ATTACK_FRAMES;n++){
                player.draw();player.update();const pose=getSwordPose(player);tips.push(pose.angle);
                if(player.swordHitbox){hitFront ||=checkAABB(player.swordHitbox,front);assert(!checkAABB(player.swordHitbox,behind),'Swing must not hit behind hero');}
            }
            assert(hitFront,'Sweeping blade must hit forward target');assert(tips[tips.length-1]-tips[0]>2,'Sword rotates through an arc');
            assert(!player.isAttacking);assert.equal(player.swordHitbox,null);
        }
    }`);
    console.log('PASS townsperson facing, smooth start/stop, stride and screen boundary; four-direction sword arcs, wind-up/recovery and moving damage area');
    run(`{
        const setup=()=>{
            startNewGame();const room=getRoom(currentRoomX,currentRoomY);
            room.tiles=Array.from({length:SCREEN_ROWS},()=>Array(SCREEN_COLS).fill(0));room.npcs=[];
            player.x=100;player.y=100;keys.Space=false;keys.KeyZ=false;
        };
        for(const dir of ['up','down','left','right']){
            setup();player.dir=dir;keys.Space=true;keyPress.Space=true;player.update();
            for(let n=1;n<SWORD_CHARGE_FRAMES;n++)player.update();
            assert(player.isCharging);assert(!player.isAttacking);assert.equal(player.swordHitbox,null);
            assert.equal(player.swordHoldFrames,SWORD_CHARGE_FRAMES);
            const position=[player.x,player.y];keys.KeyD=true;player.update();keys.KeyD=false;
            assert.equal(player.x,position[0]);assert.equal(player.y,position[1]);player.draw();
            keys.Space=false;player.update();assert(player.spinAttack);assert.equal(player.attackTimer,SPIN_ATTACK_FRAMES);
            const pose=getSwordPose(player),targets=[[0,-25],[0,25],[-25,0],[25,0]].map(([dx,dy])=>({x:pose.x+dx-3,y:pose.y+dy-3,w:6,h:6}));
            const hits=new Set();
            for(let n=0;n<SPIN_ATTACK_FRAMES;n++){
                player.draw();player.update();
                if(player.swordHitbox)targets.forEach((target,index)=>{if(checkAABB(player.swordHitbox,target))hits.add(index);});
            }
            assert.equal(hits.size,4,'Spin sweeps every side');
            assert(!player.spinAttack&&!player.isAttacking&&!player.isCharging);
            assert.equal(player.swordHitbox,null);assert(!player.swordHoldActive);
        }
        setup();keys.KeyZ=true;keyPress.KeyZ=true;player.update();
        for(let n=1;n<SWORD_CHARGE_FRAMES-1;n++)player.update();
        assert.equal(player.swordHoldFrames,SWORD_CHARGE_FRAMES-1);
        keys.KeyZ=false;player.update();assert(!player.spinAttack&&!player.isCharging,'Early release cannot spin');
        setup();keys.Space=true;keys.KeyZ=true;keyPress.Space=true;keyPress.KeyZ=true;player.update();
        assert(!keyPress.Space&&!keyPress.KeyZ,'Gamepad aliases cannot queue a duplicate slash');
        for(let n=1;n<SWORD_CHARGE_FRAMES;n++)player.update();
        openPauseMenu();assert(!player.isCharging&&!player.swordHoldActive);
        keys.Space=false;keys.KeyZ=false;gameState='PLAYING';player.update();assert(!player.spinAttack);
        setup();keys.Space=true;keyPress.Space=true;player.update();
        for(let n=1;n<SWORD_CHARGE_FRAMES;n++)player.update();
        const saved=createSaveData();applySaveData(saved);assert(!player.isCharging&&!player.swordHoldActive&&!player.spinAttack);
        keys.Space=false;keys.KeyZ=false;
        setup();keys.Space=true;keyPress.Space=true;player.update();
        for(let n=1;n<SWORD_CHARGE_FRAMES;n++)player.update();
        const room=getRoom(currentRoomX,currentRoomY),origin=getSwordPose(player);
        const enemies=[[0,-25],[0,25],[-25,0],[25,0]].map(([dx,dy])=>{
            const enemy=new Enemy(origin.x+dx-7,origin.y+dy-7,currentRoomX,currentRoomY,'stone_shooter');
            enemy.health=5;enemy.update=()=>{enemy.knockbackTimer=0;};return enemy;
        });
        room.enemies=enemies;player.invincibleTimer=1000;
        const bushes=[[4,6],[8,6],[6,4],[6,8]];for(const [c,r] of bushes)room.tiles[r][c]=43;
        keys.Space=false;updatePlaying();
        for(let n=0;n<SPIN_ATTACK_FRAMES;n++)updatePlaying();
        for(const enemy of enemies)assert.equal(enemy.health,4,'Each surrounding enemy is hit once per spin');
        for(const [c,r] of bushes)assert.equal(room.tiles[r][c],0,'Spin cuts surrounding bushes');
    }`);
    console.log('PASS hold/release charge threshold, 360-degree spin, surrounding enemy damage and bush cutting, early release, pause/load cancellation and gamepad aliases');
    run(`{
        Math.random=()=>0.9;
        const travel=(dx,dy,index)=>{
            const anchor=getRoomKey(currentRoomX,currentRoomY);
            player.x=dx<0?-1:dx>0?SCREEN_COLS*TILE-player.w+1:7*TILE;
            player.y=dy<0?-1:dy>0?SCREEN_ROWS*TILE-player.h+1:5*TILE;
            startTransition(dx,dy);
            for(let n=0;n<70&&isTransitioning;n++) updateTransition();
            assert(!isTransitioning);assert.equal(dungeonRoomIndex,index);
            assert.equal(getRoomKey(currentRoomX,currentRoomY),anchor,'Dungeon travel cannot change field coordinates');
            assert(!checkCollision(player.x,player.y,player.w,player.h),'Arrival must be on walkable ground');
        };
        for(const key of Object.keys(SACRED_STONE_BOSSES)){
            startNewGame();[currentRoomX,currentRoomY]=key.split(',').map(Number);
            const field=getWorldRoom(currentRoomX,currentRoomY);
            assert(field.dungeonEntrance);assert(!field.enemies.some(e=>e.isBoss));
            player.x=7*TILE+2;player.y=7*TILE;player.dir='up';keyPress.Space=true;player.update();
            assert(activeDungeon);assert.equal(activeDungeon.key,key);assert.equal(dungeonRoomIndex,0);
            for(let index=0;index<DUNGEON_ROOMS.length;index++){
                const room=getDungeonRoom(index);
                assert.equal(room.enemies.filter(e=>e.isBoss).length,index===DUNGEON_BOSS_ROOM?1:0);
                drawRoom(room,0,0);
                room.enemies.forEach(e=>{for(let f=1;f<=4;f++){e.animFrame=f;e.draw();}});
                const reachable=new Set(['7,8']),queue=[[7,8]];
                while(queue.length){const [c,r]=queue.shift();for(const [dc,dr] of [[0,1],[0,-1],[1,0],[-1,0]]){
                    const nc=c+dc,nr=r+dr,id=nc+','+nr;
                    if(nc<0||nr<0||nc>=SCREEN_COLS||nr>=SCREEN_ROWS||reachable.has(id)||isSolid(room.tiles[nr][nc]))continue;
                    reachable.add(id);queue.push([nc,nr]);
                }}
                for(const direction of Object.keys(DUNGEON_ROOMS[index].exits)){
                    const destination=direction==='up'?'7,0':direction==='down'?'7,10':direction==='left'?'0,5':'15,5';
                    assert(reachable.has(destination),'Disconnected door '+key+' '+index+' '+direction);
                }
            }
            travel(0,-1,1);travel(-1,0,5);travel(1,0,1);travel(1,0,6);travel(-1,0,1);
            travel(0,-1,2);travel(0,-1,3);
            coins=123;const saved=createSaveData();leaveDungeon();assert.equal(activeDungeon,null);
            assert(applySaveData(saved));assert.equal(activeDungeon.key,key);assert.equal(dungeonRoomIndex,3);assert.equal(coins,123);
            travel(0,-1,4);
            const boss=getRoom(currentRoomX,currentRoomY).enemies.find(e=>e.isBoss);
            assert.equal(boss.type,SACRED_STONE_BOSSES[key].type);boss.health=0;updatePlaying();
            assert(clearedDungeonRooms[key+':4']);
            if(SACRED_STONE_BOSSES[key].final)assert.equal(gameState,'ENDING');
            else {assert(sacredStones[SACRED_STONE_BOSSES[key].stone]);assert.equal(gameState,'DIALOGUE');}
            leaveDungeon();enterDungeon();assert.equal(getDungeonRoom(4).enemies.length,0,'Defeated boss must stay defeated');
            const clearedSave=createSaveData();leaveDungeon();applySaveData(clearedSave);assert.equal(getDungeonRoom(4).enemies.length,0,'Cleared boss survives save/load');
            dungeonRoomIndex=0;startTransition(0,1);assert.equal(activeDungeon,null);assert.equal(gameState,'PLAYING');
        }
    }`);
    console.log('PASS all 8 dungeons / 56 rooms: entrance interaction, connected doors, side branches, deepest boss, exit, saved floor and cleared boss');
    run(`{
        startNewGame();keys.KeyW=false;keyPress.Space=false;
        coins=321;inventory.keys=4;player.health=5;
        const castle=getRoom(currentRoomX,currentRoomY);
        player.x=4*TILE;player.y=3*TILE;assert(checkCollision(player.x,player.y,player.w,player.h));
        player.update();assert(!checkCollision(player.x,player.y,player.w,player.h));
        assert.equal(coins,321);assert.equal(inventory.keys,4);assert.equal(player.health,5);
        const saved=createSaveData();saved.player.x=4*TILE;saved.player.y=3*TILE;
        assert(applySaveData(saved));assert(!checkCollision(player.x,player.y,player.w,player.h));
        assert.equal(coins,321);assert.equal(inventory.keys,4);
        for(let ry=START_ROOM_Y-2;ry<=START_ROOM_Y+2;ry++)for(let rx=START_ROOM_X-2;rx<=START_ROOM_X+2;rx++){
            if(!isCastleRoom(rx,ry))continue;
            currentRoomX=rx;currentRoomY=ry;
            const tiles=getRoom(rx,ry).tiles;
            for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
                for(let lane=0;lane<(dx?SCREEN_ROWS:SCREEN_COLS);lane++){
                    player.x=dx<0?-1:dx>0?SCREEN_COLS*TILE-player.w+1:lane*TILE;
                    player.y=dy<0?-1:dy>0?SCREEN_ROWS*TILE-player.h+1:lane*TILE;
                    const sourceBlocked=checkCollision(player.x,player.y,player.w,player.h);
                    const edgeTile=dx?tiles[lane][dx<0?0:SCREEN_COLS-1]:tiles[dy<0?0:SCREEN_ROWS-1][lane];
                    if(isSolid(edgeTile))assert(sourceBlocked,'Boundary wall must block partial exit');
                    if(sourceBlocked)continue;
                    startTransition(dx,dy);
                    for(let n=0;n<70&&isTransitioning;n++)updateTransition();
                    assert(!checkCollision(player.x,player.y,player.w,player.h),'Castle boundary arrival or rejection must be safe');
                    currentRoomX=rx;currentRoomY=ry;
                }
            }
        }
        startNewGame();const tiles=getRoom(currentRoomX,currentRoomY).tiles;
        tiles[8][5]=1;
        assert(checkCollision(5*TILE-12+0.5,8*TILE,12,12),'Fractional overlap must block');
        assert(!checkCollision(5*TILE-12,8*TILE,12,12),'Touching edge must remain free');
    }`);
    console.log('PASS castle boundaries in all four directions, fractional collision, automatic trapped-player recovery and trapped save recovery without progress loss');
    run('player.update=()=>{};Math.random=()=>0.9;');
    for(const weapon of ['sword','arrow','fire','bomb']){
        run(`startNewGame();currentRoomX=10;currentRoomY=-8;enterDungeon();dungeonRoomIndex=DUNGEON_BOSS_ROOM;const r${weapon}=getRoom(10,-8);const b${weapon}=r${weapon}.enemies[0];b${weapon}.x=100;b${weapon}.y=80;b${weapon}.health=1;b${weapon}.update=()=>{};player.x=170;player.y=130;player.invincibleTimer=100;r${weapon}.tiles=Array.from({length:SCREEN_ROWS},()=>Array(SCREEN_COLS).fill(0));`);
        if(weapon==='sword')run('player.isAttacking=true;player.swordHitbox={x:100,y:80,w:32,h:32};');
        else if(weapon==='bomb')run('const bomb=new Bomb(100,80);bomb.timer=1;playerProjectiles.push(bomb);');
        else run(`playerProjectiles.push(new PlayerProjectile(100,80,0,0,'${weapon}'));`);
        run('updatePlaying();draw();');assert.equal(run('gameState'),'ENDING',weapon);
        run('endingFrame=60;keyPress.Enter=true;update();');assert.equal(run('gameState'),'TITLE');
    }
    run('startNewGame();sacredStones["Emerald Stone"]=true;writeSaveSlot(1);applySaveData(readSaveSlot(1));');
    assert.equal(run('sacredStones["Emerald Stone"]'),true);assert.equal(run('gameState'),'PLAYING');
    run('const legacy=createSaveData();legacy.version=1;delete legacy.dungeon;delete legacy.clearedDungeonRooms;applySaveData(legacy);');
    assert.equal(run('activeDungeon'),null);assert.equal(run('gameState'),'PLAYING');
    console.log('PASS four weapon victories, ending/title return, save/load regression');
    console.log('ALL HD CHECKS PASSED (generated pixels + actual game logic; Canvas calls instrumented)');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>fs.rmSync(scratch,{recursive:true,force:true}));
