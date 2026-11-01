// プレイヤー（修羅の剣士・焔丸）。移動・真上/斜めジャンプ・しゃがみ・七星剣（弾消し）・サブ武器・即効アイテムの効果。
(function (K) {
  const WALK = 1.1, JUMP_V = 7.6, SWORD_REACH = 26, ATK_FRAMES = 16;

  class Player {
    constructor(game) { this.g = game; this.reset(32); }
    reset(x) {
      this.x = x; this.y = K.GROUND; this.vx = 0; this.vy = 0; this.w = 12; this.h = 28; this.dir = 1;
      this.onGround = true; this.hp = this.maxHp = 6; this.inv = 0; this.hurt = 0; this.crouch = false;
      this.climbPhase = 0; this.climbing = null; this.climbCooldown = 0; this.dropT = 0; this.atk = 0; this.subCd = 0; this.fx = {}; this.hist = []; this.t = 0; this.takeoffVx = 0; this.safeX = x; this.safeY = this.y;
      this.swingHit = new Set(); this.pitCool = 0;
    }
    get hb() { const h = this.crouch ? 18 : 28; return { x: this.x - 6, y: this.y - h, w: 12, h: h }; }
    invincible() { return this.inv > 0 || this.fx.dragon > 0 || this.fx.twin > 0 || this.fx.after > 0; }

    // 分身（小分身=3体・双身=1体）。過去の位置をたどって付いてくる
    bodies() {
      const list = [{ x: this.x, y: this.y, dir: this.dir, atk: this.atk, crouch: this.crouch }];
      const delays = this.fx.mini > 0 ? [10, 20, 30] : (this.fx.twin > 0 ? [14] : []);
      for (const d of delays) {
        const h = this.hist[this.hist.length - 1 - d];
        if (h) list.push({ x: h.x, y: h.y, dir: h.dir, atk: h.atk, crouch: h.crouch });
      }
      return list;
    }
    // 剣の当たり判定（攻撃中・旋風斬・龍変化）。分身の分も返す
    swordBoxes() {
      const out=[];
      for(const b of this.bodies()){
        if(b.atk>0){
          const angle=(16-b.atk)*Math.PI*2/16-Math.PI/2;
          const wristX=b.x+b.dir*12,wristY=b.y-(b.crouch?12:25),reach=this.fx.dragon>0?34:24;
          const tipX=wristX+Math.cos(angle)*reach,tipY=wristY+Math.sin(angle)*reach;
          // Sample the rotating blade, rather than one fixed forward thrust rectangle.
          for(let i=0;i<=3;i++){const q=i/3;out.push({x:wristX+(tipX-wristX)*q-5,y:wristY+(tipY-wristY)*q-5,w:10,h:10,swing:true});}
        }
        if(this.fx.spin>0||this.fx.dragon>0)out.push({x:b.x-22,y:b.y-34,w:44,h:36,swing:false});
      }
      return out;
    }

    update(inp) {
      const g = this.g; this.t++;
      for (const k in this.fx) if (this.fx[k] > 0) this.fx[k]--;
      if (this.inv > 0) this.inv--; if (this.hurt > 0) this.hurt--; if (this.subCd > 0) this.subCd--;
      const L = inp.down.left, R = inp.down.right, U = inp.down.up, D = inp.down.down;
      const flying = this.fx.fly > 0;
      this.crouch = this.onGround && D && !flying && this.hurt <= 0;
      const speed = WALK * (this.fx.speed > 0 ? 1.6 : 1);

      const jumpPressed=inp.pressed.jump||inp.pressed.up;
      if(this.climbCooldown>0)this.climbCooldown--;
      const trunks=g.stage.geometry?.climbables||[];
      if(this.climbing&&(!trunks.includes(this.climbing)||this.hurt>0||flying||g.boss))this.climbing=null;
      if(!this.climbing&&(U||D)&&!inp.pressed.jump&&(!g.nearDoor||!this.onGround)&&!flying&&!g.boss&&this.hurt<=0&&this.climbCooldown<=0){
        this.climbing=trunks.slice().sort((a,b)=>a.top-b.top).find(c=>(U||Math.abs(this.y-c.top)<3)&&Math.abs(this.x-c.x)<=c.w/2+6&&this.y>=c.top-2&&this.y-this.h<=c.bottom)||null;
        if(this.climbing){this.x=this.climbing.x;this.vx=0;this.vy=0;this.onGround=false;}
      }
      let climbMove=false;
      if(this.climbing){
        const c=this.climbing;this.crouch=false;
        if(inp.pressed.jump || L!==R){
          this.climbing=null;this.climbCooldown=24;this.vy=inp.pressed.jump?-JUMP_V:0;if(inp.pressed.jump)g.sfx('jump');
          this.takeoffVx=((R?1:0)-(L?1:0))*WALK;this.vx=this.takeoffVx;this.onGround=false;
        }else{
          const oldY=this.y;this.y=K.clamp(this.y+((D?1:0)-(U?1:0))*1.2,c.top,c.bottom);
          this.climbPhase+=(oldY-this.y)/12;
          this.vx=0;this.vy=0;this.onGround=false;climbMove=true;
          if(this.y===c.top&&U){this.climbing=null;this.onGround=true;this.safeX=this.x;this.safeY=this.y;this.climbCooldown=12;}
          if(this.y===c.bottom&&D){this.climbing=null;this.onGround=true;this.climbCooldown=12;}
        }
      }
      if (climbMove) {
        // The trunk holds the player in place while idle; vertical movement is explicit.
      } else if (flying) {                                   // 飛翔: 重力なしで8方向に動く
        this.vx = ((R ? 1 : 0) - (L ? 1 : 0)) * 1.3; this.vy = ((D ? 1 : 0) - (U ? 1 : 0)) * 1.3; this.onGround = false;
        if (this.vx) this.dir = this.vx > 0 ? 1 : -1;
      } else if (this.hurt > 0) {
        // ノックバック中は操作を受け付けない
      } else if (this.onGround) {
        if (this.crouch) this.vx = 0;
        else { this.vx = ((R ? 1 : 0) - (L ? 1 : 0)) * speed; if (this.vx) this.dir = this.vx > 0 ? 1 : -1; }
        if (jumpPressed && !this.crouch && !(g.nearDoor && inp.pressed.up)) {       // 真上(vx=0)も斜め(vx≠0)も、離陸時の向きで弧が決まる
          g.sfx('jump');this.vy = -JUMP_V; this.onGround = false; this.takeoffVx = this.vx;
        }
        this.takeoffVx=this.vx;
      } else {
        this.vx = this.takeoffVx;                     // 空中は舵が効かない（古典的なアクションの作法）
      }
      if (!flying && !climbMove) this.vy = Math.min(this.vy + K.GRAV, K.MAXFALL);

      // 移動と着地
      if (climbMove) {
        // Position already follows the climbable trunk.
      } else if (g.stage.geometry) {
        if (D && inp.pressed.jump && this.onGround) { this.dropT=24; this.vy=0; }
        if(this.dropT>0)this.dropT--;
        const geo = g.geometry(), body = { x: this.x, y: this.y, w: this.w, h: this.crouch ? 18 : this.h, dropThrough: this.dropT>0 };
        const m = geo.move(body, this.vx, this.vy);
        this.x = K.clamp(m.x, g.minX, g.boss ? g.arenaRight() - this.w / 2 : geo.width - this.w / 2); this.y = m.y;
        if (m.hitX) this.vx = this.takeoffVx = 0;
        if (m.hitY) this.vy = 0;
        this.onGround = m.grounded;
        if (m.grounded) { this.safeX = this.x; this.safeY = this.y; }
        if (geo.belowWorld(this.y)) g.fellInPit();
      } else {
      this.x = K.clamp(this.x + this.vx, g.minX, g.stage.width - 8);
      const y0 = this.y; this.y += this.vy;
      const sup = g.supportY(this.x, y0, this.y);
      if (this.vy >= 0 && sup != null && !flying) { this.y = sup; this.vy = 0; this.onGround = true; if (!g.inPit(this.x)) this.safeX = this.x; }
      else if (!flying) this.onGround = false;
      if (flying) { this.y = K.clamp(this.y, 40, K.GROUND); if (this.y >= K.GROUND && !g.inPit(this.x)) this.onGround = true; }

      // 穴に落ちた
      if (this.y > K.H + 30) g.fellInPit();
      }

      // 七星剣（Aボタン）
      if (inp.down.attack && this.atk <= 0 && this.hurt <= 0) {
        g.sfx('sword');this.atk = ATK_FRAMES; this.swingHit.clear();
        if (this.fx.eight > 0) g.fireEight(this);
      }
      if (this.atk > 0) this.atk--;
      // サブ武器（Bボタン）
      if (inp.pressed.sub && this.subCd <= 0 && this.hurt <= 0) { g.fireSub(this); this.subCd = 12; }

      this.hist.push({ x: this.x, y: this.y, dir: this.dir, atk: this.atk, crouch: this.crouch });
      if (this.hist.length > 80) this.hist.shift();
    }

    // 被弾。無敵中は false。体力が尽きたら game.playerDown() へ
    hurtBy() {
      if (this.invincible()) return false;
      if(this.hp>1)this.g.sfx('hurt');this.hp--; this.inv = 60; this.hurt = 16; this.vy = -2.4; this.takeoffVx = -this.dir * 1.2; this.vx = this.takeoffVx;
      this.onGround = false; this.atk = 0;
      if (this.hp <= 0) this.g.playerDown();
      return true;
    }
  }
  K.Player = Player;
})(window.KOMA);
