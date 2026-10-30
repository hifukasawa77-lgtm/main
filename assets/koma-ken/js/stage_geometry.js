// 座標はワールド座標。原作の寸法が確認できた面に geometry を付けて使用する。
(function (K) {
  class StageGeometry {
    constructor(stage) {
      this.stage = stage;
      this.data = stage.geometry || null;
      this.width = this.data ? this.data.width : stage.width;
      this.height = this.data ? this.data.height : K.H;
      if (!Number.isFinite(this.width) || this.width < K.W || !Number.isFinite(this.height) || this.height < K.H)
        throw new Error('Invalid world dimensions');
      if (this.data) {
        const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= this.width && p.y >= 0 && p.y <= this.height;
        if (!point(this.data.spawn)) throw new Error('Geometry requires a valid world spawn');
        const a = this.data.bossArena;
        if (a && (![a.x,a.y,a.w,a.h,a.floorY].every(Number.isFinite) || a.w < K.W || a.h < K.H || a.x < 0 || a.y < 0 || a.x + a.w > this.width || a.y + a.h > this.height || a.floorY < a.y || a.floorY > a.y + a.h || !point(a.bossSpawn) || !point(a.playerSpawn)))
          throw new Error('Invalid boss arena');
        if (a && a.trigger && (![a.trigger.x,a.trigger.y,a.trigger.w,a.trigger.h].every(Number.isFinite) || a.trigger.w <= 0 || a.trigger.h <= 0)) throw new Error('Invalid boss trigger');
      }
      this.solids = this.data ? this.data.solids || [] : [];
      this.platforms = this.data ? this.data.platforms || [] : stage.platforms || [];
      this.ramps = this.data ? this.data.ramps || [] : [];
      for (const r of this.ramps) if (![r.x1,r.y1,r.x2,r.y2].every(Number.isFinite) || r.x1 === r.x2) throw new Error('Invalid ramp');
      for (const r of this.solids) if (![r.x,r.y,r.w,r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0)
        throw new Error('Invalid solid rectangle');
      for (const p of this.platforms) if (![p.x,p.y,p.w].every(Number.isFinite) || p.w <= 0)
        throw new Error('Invalid platform');
    }
    rampY(r, x, halfWidth) {
      const left = Math.min(r.x1,r.x2), right = Math.max(r.x1,r.x2), half = halfWidth || 0;
      if (x + half < left || x - half > right) return null;
      const slope = (r.y2-r.y1)/(r.x2-r.x1);
      const at = K.clamp(x + (slope < 0 ? half : -half), left, right);
      return r.y1 + (at - r.x1) * (r.y2 - r.y1) / (r.x2 - r.x1);
    }
    supportY(x, y0, y1, halfWidth, ignoreOneWay) {
      if (y1 < y0) return null;
      let best = null;
      const half = halfWidth || 0;
      const crosses = p => x + half >= p.x && x - half <= p.x + p.w && y0 <= p.y && y1 >= p.y;
      if (!this.data && !(this.stage.pits || []).some(p => x >= p[0] && x <= p[1]) && y0 <= K.GROUND && y1 >= K.GROUND) best = K.GROUND;
      for (const p of this.solids.concat(ignoreOneWay ? [] : this.platforms)) if (crosses(p) && (best == null || p.y < best)) best = p.y;
      for (const r of (ignoreOneWay ? [] : this.ramps)) {
        const y = this.rampY(r, x, half);
        if (y != null && y0 <= y && y1 >= y && (best == null || y < best)) best = y;
      }
      return best;
    }
    // Axis-separated swept collision; fast motion cannot skip a thin wall/ceiling.
    move(body, dx, dy) {
      let x = body.x, y = body.y, hitX = false, hitY = false, grounded = false;
      const half = body.w / 2;
      let target = K.clamp(x + dx, half, this.width - half);
      hitX = target !== x + dx;
      for (const r of this.solids) {
        if (y <= r.y || y - body.h >= r.y + r.h) continue;
        if (dx > 0 && x + half <= r.x && target + half >= r.x) { target = Math.min(target, r.x - half); hitX = true; }
        if (dx < 0 && x - half >= r.x + r.w && target - half <= r.x + r.w) { target = Math.max(target, r.x + r.w + half); hitX = true; }
      }
      x = target;
      let follow = null;
      const standing = this.supportY(body.x, y-0.001, y+0.001, half-0.001) != null;
      if (!body.dropThrough && dy >= 0 && dy <= K.GRAV + 0.01) for (const r of this.ramps) {
        const oldY = this.rampY(r, body.x, half - 0.001);
        const reach = (Math.abs(x - body.x) + (standing ? half + 4 : 0)) * Math.abs((r.y2-r.y1)/(r.x2-r.x1)) + 0.01;
        const nextY = this.rampY(r, x, half-0.001);
        if (!(oldY != null && Math.abs(oldY-y) <= 0.01) && !(standing && nextY != null && Math.abs(nextY-y) <= reach)) continue;
        const floor = this.supportY(x, y-reach, y+reach, half-0.001);
        if (floor != null && (follow == null || floor < follow)) follow = floor;
      }
      if (follow != null && this.solids.some(r => x+half > r.x && x-half < r.x+r.w && follow > r.y && follow-body.h < r.y+r.h)) {
        x = body.x; follow = null; hitX = true;
      }
      target = follow == null ? y + dy : follow;
      if (dy >= 0) {
        const floor = this.supportY(x, Math.min(y, target), target, half - 0.001, body.dropThrough);
        if (floor != null) { target = floor; hitY = true; grounded = true; }
      } else {
        for (const r of this.solids) {
          if (x + half <= r.x || x - half >= r.x + r.w) continue;
          if (y - body.h >= r.y + r.h && target - body.h <= r.y + r.h) {
            target = Math.max(target, r.y + r.h + body.h); hitY = true;
          }
        }
      }
      return { x, y: target, hitX, hitY, grounded };
    }
    camera(x, y, viewport, arena) {
      const v = viewport || { w: K.W, h: K.H };
      const bounds = arena || { x: 0, y: 0, w: this.width, h: this.height };
      return {
        x: K.clamp(x - v.w * 0.4375, bounds.x, Math.max(bounds.x, bounds.x + bounds.w - v.w)),
        y: K.clamp(y - (v.h - 80), bounds.y, Math.max(bounds.y, bounds.y + bounds.h - v.h))
      };
    }
    belowWorld(y) { return y > this.height + 30; }
  }
  K.StageGeometry = StageGeometry;
})(window.KOMA);

