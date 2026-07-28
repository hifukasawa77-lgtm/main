/**
 * chip8-core.js — CHIP-8 / SUPER-CHIP エミュレータコア
 * CHIP-8 / SUPER-CHIP interpreter core (no DOM dependency)
 *
 * DOMに依存しないため、ブラウザ（chip8.html）と Node のヘッドレステスト
 * （scripts/chip8-test.mjs）の両方から同一コードを実行できる。
 *
 * 参考仕様: Cowgod's Chip-8 Technical Reference / SUPER-CHIP 1.1 spec。
 * 実装差異は quirks フラグで切り替える（後述）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Chip8 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const FONT_ADDR = 0x50;
  const BIGFONT_ADDR = 0xa0;
  const PROGRAM_START = 0x200;
  const MEM_SIZE = 0x1000;

  /** 標準4x5フォント (0-F)。FX29 が参照する */
  const FONT = [
    0xf0, 0x90, 0x90, 0x90, 0xf0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xf0, 0x10, 0xf0, 0x80, 0xf0, // 2
    0xf0, 0x10, 0xf0, 0x10, 0xf0, // 3
    0x90, 0x90, 0xf0, 0x10, 0x10, // 4
    0xf0, 0x80, 0xf0, 0x10, 0xf0, // 5
    0xf0, 0x80, 0xf0, 0x90, 0xf0, // 6
    0xf0, 0x10, 0x20, 0x40, 0x40, // 7
    0xf0, 0x90, 0xf0, 0x90, 0xf0, // 8
    0xf0, 0x90, 0xf0, 0x10, 0xf0, // 9
    0xf0, 0x90, 0xf0, 0x90, 0x90, // A
    0xe0, 0x90, 0xe0, 0x90, 0xe0, // B
    0xf0, 0x80, 0x80, 0x80, 0xf0, // C
    0xe0, 0x90, 0x90, 0x90, 0xe0, // D
    0xf0, 0x80, 0xf0, 0x80, 0xf0, // E
    0xf0, 0x80, 0xf0, 0x80, 0x80, // F
  ];

  /** SUPER-CHIP 8x10 ラージフォント (0-F)。FX30 が参照する */
  const BIGFONT = [
    0x3c, 0x7e, 0xe7, 0xc3, 0xc3, 0xc3, 0xc3, 0xe7, 0x7e, 0x3c, // 0
    0x18, 0x38, 0x58, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3c, 0x3c, // 1
    0x3e, 0x7f, 0xc3, 0x06, 0x0c, 0x18, 0x30, 0x60, 0xff, 0xff, // 2
    0x3c, 0x7e, 0xc3, 0x03, 0x0e, 0x0e, 0x03, 0xc3, 0x7e, 0x3c, // 3
    0x06, 0x0e, 0x1e, 0x36, 0x66, 0xc6, 0xff, 0xff, 0x06, 0x06, // 4
    0xff, 0xff, 0xc0, 0xc0, 0xfc, 0xfe, 0x03, 0xc3, 0x7e, 0x3c, // 5
    0x3e, 0x7c, 0xe0, 0xc0, 0xfc, 0xfe, 0xc3, 0xc3, 0x7e, 0x3c, // 6
    0xff, 0xff, 0x03, 0x06, 0x0c, 0x18, 0x30, 0x60, 0x60, 0x60, // 7
    0x3c, 0x7e, 0xc3, 0xc3, 0x7e, 0x7e, 0xc3, 0xc3, 0x7e, 0x3c, // 8
    0x3c, 0x7e, 0xc3, 0xc3, 0x7f, 0x3f, 0x03, 0x07, 0x7e, 0x7c, // 9
    0x18, 0x3c, 0x66, 0xc3, 0xc3, 0xff, 0xff, 0xc3, 0xc3, 0xc3, // A
    0xfc, 0xfe, 0xc3, 0xc3, 0xfe, 0xfe, 0xc3, 0xc3, 0xfe, 0xfc, // B
    0x3c, 0x7e, 0xc3, 0xc0, 0xc0, 0xc0, 0xc0, 0xc3, 0x7e, 0x3c, // C
    0xfc, 0xfe, 0xc7, 0xc3, 0xc3, 0xc3, 0xc3, 0xc7, 0xfe, 0xfc, // D
    0xff, 0xff, 0xc0, 0xc0, 0xfc, 0xfc, 0xc0, 0xc0, 0xff, 0xff, // E
    0xff, 0xff, 0xc0, 0xc0, 0xfc, 0xfc, 0xc0, 0xc0, 0xc0, 0xc0, // F
  ];

  /**
   * 実装差異（quirks）。ROMごとに正しい挙動が異なるため切り替え可能にする。
   *  vfReset     : 8XY1/2/3 実行後に VF=0 にする（オリジナルCOSMAC VIPの挙動）
   *  memoryI     : FX55/FX65 実行後に I を x+1 進める（オリジナルの挙動）
   *  displayWait : DXYN が垂直帰線を待つ（1フレーム1描画に制限）
   *  clipping    : スプライトが画面端で切り取られる（false なら反対側へ回り込む）
   *  shifting    : 8XY6/8XYE が Vy をシフトして Vx へ入れる（オリジナルの挙動）
   *  jumping     : BNNN を BXNN として解釈する（SUPER-CHIPの挙動）
   */
  const QUIRK_PRESETS = {
    chip8: { vfReset: true, memoryI: true, displayWait: true, clipping: true, shifting: true, jumping: false },
    schip: { vfReset: false, memoryI: false, displayWait: false, clipping: true, shifting: false, jumping: true },
    modern: { vfReset: false, memoryI: false, displayWait: false, clipping: true, shifting: false, jumping: false },
  };

  class Chip8 {
    constructor(options = {}) {
      this.mem = new Uint8Array(MEM_SIZE);
      this.v = new Uint8Array(16);
      this.stack = new Uint16Array(16);
      this.keys = new Uint8Array(16);
      this.rpl = new Uint8Array(16);        // SUPER-CHIP の永続フラグ (FX75/FX85)
      this.display = new Uint8Array(128 * 64);
      this.quirks = Object.assign({}, QUIRK_PRESETS.chip8, options.quirks);
      // テストで決定的にするため乱数源を差し替え可能にする
      this.random = options.random || (() => Math.floor(Math.random() * 256));
      this.rom = null;
      this.reset();
    }

    reset() {
      this.mem.fill(0);
      this.mem.set(FONT, FONT_ADDR);
      this.mem.set(BIGFONT, BIGFONT_ADDR);
      this.v.fill(0);
      this.stack.fill(0);
      this.keys.fill(0);
      this.i = 0;
      this.pc = PROGRAM_START;
      this.sp = 0;
      this.dt = 0;
      this.st = 0;
      this.hires = false;
      this.width = 64;
      this.height = 32;
      this.display.fill(0);
      this.halted = false;
      this.error = null;
      this.waitingForKey = false;
      this.waitRegister = 0;
      this.waitPressedKey = -1;
      this.drawnThisFrame = false;
      this.cycles = 0;
      this.displayDirty = true;
      if (this.rom) this.mem.set(this.rom, PROGRAM_START);
    }

    /** ROMをロードして初期状態に戻す */
    loadRom(bytes) {
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (data.length > MEM_SIZE - PROGRAM_START) {
        throw new Error(`ROMが大きすぎます (${data.length} bytes / 最大 ${MEM_SIZE - PROGRAM_START})`);
      }
      this.rom = data.slice();
      this.reset();
    }

    setQuirks(patch) {
      Object.assign(this.quirks, patch);
    }

    setKey(index, down) {
      if (index < 0 || index > 15) return;
      this.keys[index] = down ? 1 : 0;
    }

    pixel(x, y) {
      return this.display[y * this.width + x];
    }

    /** 60Hzで呼ぶ。ディレイ/サウンドタイマを1つ減らす */
    tickTimers() {
      if (this.dt > 0) this.dt--;
      if (this.st > 0) this.st--;
    }

    /** サウンドタイマが動作中か（UI側でビープを鳴らす判定に使う） */
    get beeping() {
      return this.st > 0;
    }

    /**
     * 1フレーム分実行する。
     * @param {number} ipf 1フレームあたりの命令実行数
     */
    runFrame(ipf) {
      this.drawnThisFrame = false;
      for (let n = 0; n < ipf; n++) {
        if (this.halted) break;
        this.step();
        // displayWait quirk: 描画したらそのフレームの実行を打ち切る
        if (this.quirks.displayWait && this.drawnThisFrame) break;
        // キー待ちに入ったら、そのフレームでは以降の命令を進めない
        if (this.waitingForKey) break;
      }
      this.tickTimers();
    }

    /** 1命令実行する */
    step() {
      if (this.halted) return;

      // FX0A: キーが「押されてから離される」まで待つ
      if (this.waitingForKey) {
        if (this.waitPressedKey === -1) {
          for (let k = 0; k < 16; k++) {
            if (this.keys[k]) { this.waitPressedKey = k; break; }
          }
        } else if (!this.keys[this.waitPressedKey]) {
          this.v[this.waitRegister] = this.waitPressedKey;
          this.waitingForKey = false;
          this.waitPressedKey = -1;
        }
        return;
      }

      if (this.pc > MEM_SIZE - 2) return this.fail(`PCがメモリ範囲外です (${fmt(this.pc, 3)})`);
      const op = (this.mem[this.pc] << 8) | this.mem[this.pc + 1];
      this.pc = (this.pc + 2) & 0xfff;
      this.cycles++;
      this.execute(op);
    }

    fail(message) {
      this.error = message;
      this.halted = true;
    }

    execute(op) {
      const x = (op & 0x0f00) >> 8;
      const y = (op & 0x00f0) >> 4;
      const n = op & 0x000f;
      const kk = op & 0x00ff;
      const nnn = op & 0x0fff;
      const v = this.v;

      switch (op & 0xf000) {
        case 0x0000:
          if (op === 0x00e0) {                       // CLS
            this.display.fill(0);
            this.displayDirty = true;
          } else if (op === 0x00ee) {                // RET
            if (this.sp === 0) return this.fail('空のスタックから RET しました');
            this.pc = this.stack[--this.sp];
          } else if ((op & 0xfff0) === 0x00c0) {     // 00CN: N行下へスクロール
            this.scrollDown(n);
          } else if (op === 0x00fb) {                // 00FB: 右へ4px
            this.scrollRight(4);
          } else if (op === 0x00fc) {                // 00FC: 左へ4px
            this.scrollLeft(4);
          } else if (op === 0x00fd) {                // 00FD: 終了
            this.halted = true;
          } else if (op === 0x00fe) {                // 00FE: 低解像度 64x32
            this.setResolution(false);
          } else if (op === 0x00ff) {                // 00FF: 高解像度 128x64
            this.setResolution(true);
          }
          // 0NNN (SYS) は実機のマシンコード呼び出し。現代の実装では無視する
          break;

        case 0x1000:                                  // 1NNN: JP addr
          this.pc = nnn;
          break;

        case 0x2000:                                  // 2NNN: CALL addr
          if (this.sp >= this.stack.length) return this.fail('スタックオーバーフローです');
          this.stack[this.sp++] = this.pc;
          this.pc = nnn;
          break;

        case 0x3000: if (v[x] === kk) this.skip(); break;      // 3XKK: SE Vx, byte
        case 0x4000: if (v[x] !== kk) this.skip(); break;      // 4XKK: SNE Vx, byte
        case 0x5000:                                            // 5XY0: SE Vx, Vy
          if (n !== 0) return this.fail(`未知の命令 ${fmt(op, 4)}`);
          if (v[x] === v[y]) this.skip();
          break;
        case 0x6000: v[x] = kk; break;                          // 6XKK: LD Vx, byte
        case 0x7000: v[x] = (v[x] + kk) & 0xff; break;          // 7XKK: ADD Vx, byte

        case 0x8000: this.alu(op, x, y, n); break;

        case 0x9000:                                            // 9XY0: SNE Vx, Vy
          if (n !== 0) return this.fail(`未知の命令 ${fmt(op, 4)}`);
          if (v[x] !== v[y]) this.skip();
          break;
        case 0xa000: this.i = nnn; break;                        // ANNN: LD I, addr

        case 0xb000:                                             // BNNN / BXNN: JP V0, addr
          this.pc = (nnn + (this.quirks.jumping ? v[x] : v[0])) & 0xfff;
          break;

        case 0xc000: v[x] = this.random() & kk; break;           // CXKK: RND Vx, byte
        case 0xd000: this.draw(v[x], v[y], n); break;            // DXYN: DRW

        case 0xe000:
          if (kk === 0x9e) { if (this.keys[v[x] & 0xf]) this.skip(); }        // EX9E: SKP
          else if (kk === 0xa1) { if (!this.keys[v[x] & 0xf]) this.skip(); }  // EXA1: SKNP
          else return this.fail(`未知の命令 ${fmt(op, 4)}`);
          break;

        case 0xf000: this.misc(op, x, kk); break;

        default:
          this.fail(`未知の命令 ${fmt(op, 4)}`);
      }
    }

    /**
     * 条件スキップ。次の命令が F000（XO-CHIP の4バイト命令）の場合は
     * 4バイト飛ばす必要があるが、CHIP-8/SUPER-CHIP では常に2バイト。
     */
    skip() {
      this.pc = (this.pc + 2) & 0xfff;
    }

    alu(op, x, y, n) {
      const v = this.v;
      switch (n) {
        case 0x0: v[x] = v[y]; break;                             // 8XY0: LD
        case 0x1:                                                  // 8XY1: OR
          v[x] |= v[y];
          if (this.quirks.vfReset) v[0xf] = 0;
          break;
        case 0x2:                                                  // 8XY2: AND
          v[x] &= v[y];
          if (this.quirks.vfReset) v[0xf] = 0;
          break;
        case 0x3:                                                  // 8XY3: XOR
          v[x] ^= v[y];
          if (this.quirks.vfReset) v[0xf] = 0;
          break;
        case 0x4: {                                                // 8XY4: ADD（桁上がり）
          const sum = v[x] + v[y];
          v[x] = sum & 0xff;
          v[0xf] = sum > 0xff ? 1 : 0;   // VF はレジスタ更新の「後」に書く（x==0xF の場合に効く）
          break;
        }
        case 0x5: {                                                // 8XY5: SUB（借りなし=1）
          const noBorrow = v[x] >= v[y] ? 1 : 0;
          v[x] = (v[x] - v[y]) & 0xff;
          v[0xf] = noBorrow;
          break;
        }
        case 0x6: {                                                // 8XY6: SHR
          const src = this.quirks.shifting ? v[y] : v[x];
          const lsb = src & 1;
          v[x] = src >> 1;
          v[0xf] = lsb;
          break;
        }
        case 0x7: {                                                // 8XY7: SUBN
          const noBorrow = v[y] >= v[x] ? 1 : 0;
          v[x] = (v[y] - v[x]) & 0xff;
          v[0xf] = noBorrow;
          break;
        }
        case 0xe: {                                                // 8XYE: SHL
          const src = this.quirks.shifting ? v[y] : v[x];
          const msb = (src & 0x80) >> 7;
          v[x] = (src << 1) & 0xff;
          v[0xf] = msb;
          break;
        }
        default:
          this.fail(`未知の 8xy${n.toString(16)} 命令`);
      }
    }

    misc(op, x, kk) {
      const v = this.v;
      switch (kk) {
        case 0x07: v[x] = this.dt; break;                          // FX07: LD Vx, DT
        case 0x0a:                                                 // FX0A: LD Vx, K
          this.waitingForKey = true;
          this.waitRegister = x;
          this.waitPressedKey = -1;
          break;
        case 0x15: this.dt = v[x]; break;                          // FX15: LD DT, Vx
        case 0x18: this.st = v[x]; break;                          // FX18: LD ST, Vx
        case 0x1e: this.i = (this.i + v[x]) & 0xfff; break;        // FX1E: ADD I, Vx
        case 0x29: this.i = FONT_ADDR + (v[x] & 0xf) * 5; break;   // FX29: LD F, Vx
        case 0x30: this.i = BIGFONT_ADDR + (v[x] & 0xf) * 10; break; // FX30: LD HF, Vx
        case 0x33: {                                               // FX33: BCD
          const value = v[x];
          this.mem[this.i & 0xfff] = Math.floor(value / 100);
          this.mem[(this.i + 1) & 0xfff] = Math.floor(value / 10) % 10;
          this.mem[(this.i + 2) & 0xfff] = value % 10;
          break;
        }
        case 0x55:                                                 // FX55: LD [I], Vx
          for (let k = 0; k <= x; k++) this.mem[(this.i + k) & 0xfff] = v[k];
          if (this.quirks.memoryI) this.i = (this.i + x + 1) & 0xfff;
          break;
        case 0x65:                                                 // FX65: LD Vx, [I]
          for (let k = 0; k <= x; k++) v[k] = this.mem[(this.i + k) & 0xfff];
          if (this.quirks.memoryI) this.i = (this.i + x + 1) & 0xfff;
          break;
        case 0x75:                                                 // FX75: 永続フラグへ保存
          for (let k = 0; k <= Math.min(x, 15); k++) this.rpl[k] = v[k];
          break;
        case 0x85:                                                 // FX85: 永続フラグから復元
          for (let k = 0; k <= Math.min(x, 15); k++) v[k] = this.rpl[k];
          break;
        default:
          this.fail(`未知の Fx${kk.toString(16).padStart(2, '0')} 命令`);
      }
    }

    setResolution(hires) {
      if (this.hires === hires) return;
      this.hires = hires;
      this.width = hires ? 128 : 64;
      this.height = hires ? 64 : 32;
      this.display.fill(0);
      this.displayDirty = true;
    }

    /**
     * スプライト描画。
     * 開始座標は常に画面サイズで剰余をとる（これは全実装共通）。
     * そこからはみ出した分を切り取るか回り込ませるかは clipping quirk が決める。
     */
    draw(vx, vy, n) {
      const { width: w, height: h, display, mem, quirks } = this;
      const startX = vx % w;
      const startY = vy % h;
      const big = n === 0;                // DXY0: 16x16 スプライト (SUPER-CHIP)
      const rows = big ? 16 : n;
      const cols = big ? 16 : 8;
      let collision = 0;

      for (let row = 0; row < rows; row++) {
        let bits;
        if (big) {
          const addr = (this.i + row * 2) & 0xfff;
          bits = (mem[addr] << 8) | mem[(addr + 1) & 0xfff];
        } else {
          bits = mem[(this.i + row) & 0xfff];
        }
        let py = startY + row;
        if (py >= h) {
          if (quirks.clipping) break;
          py %= h;
        }
        for (let col = 0; col < cols; col++) {
          const on = (bits >> (cols - 1 - col)) & 1;
          if (!on) continue;
          let px = startX + col;
          if (px >= w) {
            if (quirks.clipping) continue;
            px %= w;
          }
          const idx = py * w + px;
          if (display[idx]) collision = 1;
          display[idx] ^= 1;
        }
      }

      this.v[0xf] = collision;
      this.displayDirty = true;
      this.drawnThisFrame = true;
    }

    scrollDown(rows) {
      const { width: w, height: h, display } = this;
      if (rows <= 0) return;
      for (let y = h - 1; y >= 0; y--) {
        const src = y - rows;
        const dstOff = y * w;
        if (src < 0) display.fill(0, dstOff, dstOff + w);
        else display.copyWithin(dstOff, src * w, src * w + w);
      }
      this.displayDirty = true;
    }

    scrollRight(px) {
      const { width: w, height: h, display } = this;
      for (let y = 0; y < h; y++) {
        const off = y * w;
        display.copyWithin(off + px, off, off + w - px);
        display.fill(0, off, off + px);
      }
      this.displayDirty = true;
    }

    scrollLeft(px) {
      const { width: w, height: h, display } = this;
      for (let y = 0; y < h; y++) {
        const off = y * w;
        display.copyWithin(off, off + px, off + w);
        display.fill(0, off + w - px, off + w);
      }
      this.displayDirty = true;
    }

    /** セーブステート用スナップショット */
    saveState() {
      return {
        mem: Array.from(this.mem), v: Array.from(this.v), stack: Array.from(this.stack),
        rpl: Array.from(this.rpl), display: Array.from(this.display),
        i: this.i, pc: this.pc, sp: this.sp, dt: this.dt, st: this.st,
        hires: this.hires, halted: this.halted, cycles: this.cycles,
      };
    }

    loadState(s) {
      this.mem.set(s.mem); this.v.set(s.v); this.stack.set(s.stack);
      this.rpl.set(s.rpl); this.display.set(s.display);
      this.i = s.i; this.pc = s.pc; this.sp = s.sp; this.dt = s.dt; this.st = s.st;
      this.setResolutionForced(s.hires);
      this.display.set(s.display);
      this.halted = s.halted; this.cycles = s.cycles;
      this.waitingForKey = false;
      this.error = null;
      this.displayDirty = true;
    }

    setResolutionForced(hires) {
      this.hires = hires;
      this.width = hires ? 128 : 64;
      this.height = hires ? 64 : 32;
    }
  }

  function fmt(n, w) {
    return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w, '0');
  }

  /** 逆アセンブル（デバッガ表示用）。1命令ぶんの文字列を返す */
  function disassemble(op) {
    const x = (op & 0x0f00) >> 8;
    const y = (op & 0x00f0) >> 4;
    const n = op & 0x000f;
    const kk = op & 0x00ff;
    const nnn = op & 0x0fff;
    const V = (r) => 'V' + r.toString(16).toUpperCase();
    const A = (a) => '$' + a.toString(16).toUpperCase().padStart(3, '0');
    const B = (b) => '#' + b.toString(16).toUpperCase().padStart(2, '0');

    switch (op & 0xf000) {
      case 0x0000:
        if (op === 0x00e0) return 'CLS';
        if (op === 0x00ee) return 'RET';
        if ((op & 0xfff0) === 0x00c0) return `SCD ${n}`;
        if (op === 0x00fb) return 'SCR';
        if (op === 0x00fc) return 'SCL';
        if (op === 0x00fd) return 'EXIT';
        if (op === 0x00fe) return 'LOW';
        if (op === 0x00ff) return 'HIGH';
        return `SYS ${A(nnn)}`;
      case 0x1000: return `JP ${A(nnn)}`;
      case 0x2000: return `CALL ${A(nnn)}`;
      case 0x3000: return `SE ${V(x)}, ${B(kk)}`;
      case 0x4000: return `SNE ${V(x)}, ${B(kk)}`;
      case 0x5000: return n === 0 ? `SE ${V(x)}, ${V(y)}` : '??';
      case 0x6000: return `LD ${V(x)}, ${B(kk)}`;
      case 0x7000: return `ADD ${V(x)}, ${B(kk)}`;
      case 0x8000:
        switch (n) {
          case 0x0: return `LD ${V(x)}, ${V(y)}`;
          case 0x1: return `OR ${V(x)}, ${V(y)}`;
          case 0x2: return `AND ${V(x)}, ${V(y)}`;
          case 0x3: return `XOR ${V(x)}, ${V(y)}`;
          case 0x4: return `ADD ${V(x)}, ${V(y)}`;
          case 0x5: return `SUB ${V(x)}, ${V(y)}`;
          case 0x6: return `SHR ${V(x)}, ${V(y)}`;
          case 0x7: return `SUBN ${V(x)}, ${V(y)}`;
          case 0xe: return `SHL ${V(x)}, ${V(y)}`;
          default: return '??';
        }
      case 0x9000: return n === 0 ? `SNE ${V(x)}, ${V(y)}` : '??';
      case 0xa000: return `LD I, ${A(nnn)}`;
      case 0xb000: return `JP V0, ${A(nnn)}`;
      case 0xc000: return `RND ${V(x)}, ${B(kk)}`;
      case 0xd000: return `DRW ${V(x)}, ${V(y)}, ${n}`;
      case 0xe000:
        if (kk === 0x9e) return `SKP ${V(x)}`;
        if (kk === 0xa1) return `SKNP ${V(x)}`;
        return '??';
      case 0xf000:
        switch (kk) {
          case 0x07: return `LD ${V(x)}, DT`;
          case 0x0a: return `LD ${V(x)}, K`;
          case 0x15: return `LD DT, ${V(x)}`;
          case 0x18: return `LD ST, ${V(x)}`;
          case 0x1e: return `ADD I, ${V(x)}`;
          case 0x29: return `LD F, ${V(x)}`;
          case 0x30: return `LD HF, ${V(x)}`;
          case 0x33: return `LD B, ${V(x)}`;
          case 0x55: return `LD [I], ${V(x)}`;
          case 0x65: return `LD ${V(x)}, [I]`;
          case 0x75: return `LD R, ${V(x)}`;
          case 0x85: return `LD ${V(x)}, R`;
          default: return '??';
        }
      default: return '??';
    }
  }

  return { Chip8, disassemble, QUIRK_PRESETS, FONT, BIGFONT, PROGRAM_START, FONT_ADDR, BIGFONT_ADDR };
});
