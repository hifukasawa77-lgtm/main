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
    assert.equal(run('FahrenVisuals.sheets.length'),14);
    assert.equal(run('FahrenVisuals.sheets.reduce((n,s)=>n+s.cols*s.rows,0)'),232);
    assert(run('Object.keys(ENEMY_PROFILES).every(type => type === "worm" ? [1,2,3,4].every(n=>sprites[`worm_emerge_${n}`]&&sprites[`worm_hidden_${n}`]) : [1,2,3,4].every(n=>sprites[`${type}_${n}`]))'));
    assert(run('sprites.hero_down_1.image.width===84 && sprites.boss_gran_4.image.width===150'));
    console.log('PASS all 232 generated frames loaded, every enemy/boss covered, HD backing resolution');
    run('startNewGame();');
    // Render all 625 rooms, all species and all four animation frames.
    run(`for(let y=WORLD_MIN;y<=WORLD_MAX;y++) for(let x=WORLD_MIN;x<=WORLD_MAX;x++) {
        currentRoomX=x;currentRoomY=y;const room=getRoom(x,y);drawRoom(room,0,0);
        for(const actor of [...(room.enemies||[]),...(room.npcs||[])]) for(let f=1;f<=4;f++){actor.animFrame=f;actor.draw();}
    }`);
    console.log('PASS all 625 rooms and actor animation frames render without missing/non-finite images');
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
        Math.random=()=>0.9;
        const travel=(dx,dy,index)=>{
            const anchor=getRoomKey(currentRoomX,currentRoomY);
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
