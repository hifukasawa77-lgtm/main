#!/usr/bin/env node
/**
 * CHIP-8 コアのヘッドレステスト / headless test for assets/js/chip8-core.js
 *
 *   node scripts/chip8-test.mjs
 *
 * ブラウザを使わず、命令セット・quirks・スプライト描画・同梱ROMの起動を検証する。
 * chip8-core.js は DOM に依存しないため Node からそのまま require できる。
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assemble } from './chip8-asm.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { Chip8, disassemble, QUIRK_PRESETS } = require(join(ROOT, 'assets/js/chip8-core.js'));

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push({ name, message: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '条件が false です');
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || '値が一致しません'}: 期待 ${expected} / 実際 ${actual}`);
  }
}

/** アセンブリを組み立てて cycles 命令ぶん実行し、マシンを返す */
function run(src, { cycles = 64, quirks = {}, random = () => 0x42 } = {}) {
  const { bytes } = assemble(src);
  const m = new Chip8({ quirks: { ...QUIRK_PRESETS.modern, ...quirks }, random });
  m.loadRom(bytes);
  for (let i = 0; i < cycles && !m.halted; i++) m.step();
  return m;
}

// ---------------------------------------------------------------- 基本命令
test('6XKK/7XKK: 即値ロードと加算（255を超えたら折り返す）', () => {
  const m = run(`
    LD V0, 0x10
    ADD V0, 0x05
    LD V1, 0xFF
    ADD V1, 0x02
    EXIT
  `);
  eq(m.v[0], 0x15, 'V0');
  eq(m.v[1], 0x01, 'V1 は 0xFF+2 で折り返す');
});

test('8XY4: ADD の桁上がりが VF に入る', () => {
  const m = run(`
    LD V0, 200
    LD V1, 100
    ADD V0, V1
    EXIT
  `);
  eq(m.v[0], 44, 'V0 = 300 & 0xFF');
  eq(m.v[0xf], 1, 'VF = 桁上がり');
});

test('8XY4: VF を宛先にすると結果ではなくフラグが残る', () => {
  // VF は「値を書いた後」にフラグで上書きされる。順序を誤るとフラグが消える
  const m = run(`
    LD VF, 200
    LD V1, 100
    ADD VF, V1
    EXIT
  `);
  eq(m.v[0xf], 1, 'VF にはフラグが残る');
});

test('8XY5/8XY7: SUB / SUBN の借りフラグ（借りなし=1）', () => {
  const m = run(`
    LD V0, 5
    LD V1, 3
    SUB V0, V1
    LD V2, 3
    LD V3, 5
    SUB V2, V3
    EXIT
  `);
  eq(m.v[0], 2, 'V0 = 5-3');
  eq(m.v[2], 254, 'V2 = 3-5 は折り返す');
  eq(m.v[0xf], 0, '借りが発生したので VF=0');

  const m2 = run(`
    LD V0, 3
    LD V1, 5
    SUBN V0, V1
    EXIT
  `);
  eq(m2.v[0], 2, 'SUBN は Vy-Vx');
  eq(m2.v[0xf], 1, '借りなしなので VF=1');
});

test('BCD (FX33): 3桁へ分解する', () => {
  const m = run(`
    LD V0, 254
    LD I, buffer
    LD B, V0
    EXIT
    buffer: DB 0, 0, 0
  `);
  const base = m.i;
  eq(m.mem[base], 2, '百の位');
  eq(m.mem[base + 1], 5, '十の位');
  eq(m.mem[base + 2], 4, '一の位');
});

test('2NNN/00EE: CALL と RET でスタックが戻る', () => {
  const m = run(`
    CALL sub
    LD V1, 0x22
    EXIT
    sub:
      LD V0, 0x11
      RET
  `);
  eq(m.v[0], 0x11, 'サブルーチンが実行された');
  eq(m.v[1], 0x22, '戻り先が実行された');
  eq(m.sp, 0, 'スタックが空に戻る');
});

test('3XKK/4XKK/5XY0/9XY0: 条件スキップ', () => {
  const m = run(`
    LD V0, 5
    SE V0, 5
    LD V0, 0xFF     ; スキップされる
    SNE V0, 9
    LD V0, 0xFE     ; スキップされる
    LD V1, 5
    SE V0, V1
    LD V0, 0xFD     ; スキップされる
    EXIT
  `);
  eq(m.v[0], 5, 'すべてスキップされ V0 は 5 のまま');
});

test('FX29: フォントアドレスが正しい文字を指す', () => {
  const m = run(`
    LD V0, 0
    LD F, V0
    EXIT
  `);
  eq(m.mem[m.i], 0xf0, '"0" のフォント先頭バイト');
  eq(m.mem[m.i + 4], 0xf0, '"0" のフォント最終バイト');
});

test('FX15/FX07: ディレイタイマの設定と読み出し', () => {
  const { bytes } = assemble(`
    LD V0, 3
    LD DT, V0
    LD V1, DT
    EXIT
  `);
  const m = new Chip8();
  m.loadRom(bytes);
  m.step(); m.step(); m.step();
  eq(m.v[1], 3, 'DT を読み出せる');
  m.tickTimers();
  eq(m.dt, 2, 'tickTimers で 1 減る');
});

// ---------------------------------------------------------------- quirks
test('quirk shifting: 8XY6 が Vy 由来か Vx 由来か切り替わる', () => {
  const src = `
    LD V0, 0
    LD V1, 8
    SHR V0, V1
    EXIT
  `;
  eq(run(src, { quirks: { shifting: true } }).v[0], 4, 'オリジナル挙動: Vy をシフト');
  eq(run(src, { quirks: { shifting: false } }).v[0], 0, '現代の挙動: Vx をシフト');
});

test('quirk vfReset: 8XY1/2/3 の後に VF がクリアされる', () => {
  const src = `
    LD VF, 1
    LD V0, 0x0F
    LD V1, 0xF0
    OR V0, V1
    EXIT
  `;
  eq(run(src, { quirks: { vfReset: true } }).v[0xf], 0, 'VIP 挙動では VF=0');
  eq(run(src, { quirks: { vfReset: false } }).v[0xf], 1, 'SCHIP 挙動では VF 保持');
});

test('quirk memoryI: FX55/FX65 が I を進めるかどうか', () => {
  const src = `
    LD I, buf
    LD V0, 1
    LD V1, 2
    LD [I], V1
    EXIT
    buf: DB 0, 0, 0, 0
  `;
  const on = run(src, { quirks: { memoryI: true } });
  const off = run(src, { quirks: { memoryI: false } });
  eq(on.i - off.i, 2, 'memoryI 有効時は I が x+1 = 2 進む');
  eq(off.mem[off.i], 1, '書き込み内容自体は同じ');
  eq(off.mem[off.i + 1], 2, '書き込み内容自体は同じ');
});

test('quirk jumping: BNNN と BXNN', () => {
  // JP V0, 0x300 は 0xB300 にエンコードされる。
  // BNNN 解釈なら V0 を、BXNN 解釈なら x=3 すなわち V3 を飛び先に加算する
  const src = `
    LD V0, 2
    LD V3, 4
    JP V0, 0x300
    EXIT
  `;
  eq(run(src, { quirks: { jumping: false }, cycles: 3 }).pc, 0x302, 'BNNN は V0 を加算');
  eq(run(src, { quirks: { jumping: true }, cycles: 3 }).pc, 0x304, 'BXNN は Vx(=V3) を加算');
});

test('quirk clipping: 画面端で切り取るか回り込むか', () => {
  const src = `
    LD I, sprite
    LD V0, 62      ; x=62 → 8px幅なので右に6px はみ出す
    LD V1, 0
    DRW V0, V1, 1
    EXIT
    sprite: DB 0xFF, 0x00
  `;
  const clipped = run(src, { quirks: { clipping: true } });
  eq(clipped.pixel(63, 0), 1, '画面内は描かれる');
  eq(clipped.pixel(0, 0), 0, 'clipping 有効時は回り込まない');

  const wrapped = run(src, { quirks: { clipping: false } });
  eq(wrapped.pixel(0, 0), 1, 'clipping 無効時は反対側へ回り込む');
});

test('DXYN: 開始座標は常に画面サイズで剰余をとる', () => {
  const src = `
    LD I, sprite
    LD V0, 64      ; 64 % 64 = 0
    LD V1, 33      ; 33 % 32 = 1
    DRW V0, V1, 1
    EXIT
    sprite: DB 0x80, 0x00
  `;
  const m = run(src, { quirks: { clipping: true } });
  eq(m.pixel(0, 1), 1, '(64,33) は (0,1) に描かれる');
});

test('DXYN: 重ね描きで VF=1（衝突判定）', () => {
  const src = `
    LD I, sprite
    LD V0, 10
    LD V1, 10
    DRW V0, V1, 1
    LD V2, VF      ; 1回目の VF を退避
    DRW V0, V1, 1
    EXIT
    sprite: DB 0xFF, 0x00
  `;
  const m = run(src);
  eq(m.v[2], 0, '1回目は衝突なし');
  eq(m.v[0xf], 1, '2回目は既存ピクセルを消すので VF=1');
  eq(m.pixel(10, 10), 0, 'XOR で消える');
});

// ---------------------------------------------------------------- SUPER-CHIP
test('00FF/00FE: 解像度切り替えで画面がクリアされる', () => {
  const m = run(`
    HIGH
    EXIT
  `);
  eq(m.width, 128, '高解像度は 128px 幅');
  eq(m.height, 64, '高解像度は 64px 高');
});

test('00CN: 下方向スクロール', () => {
  const m = run(`
    LD I, sprite
    LD V0, 0
    LD V1, 0
    DRW V0, V1, 1
    SCD 3
    EXIT
    sprite: DB 0x80, 0x00
  `);
  eq(m.pixel(0, 0), 0, '元の位置は空く');
  eq(m.pixel(0, 3), 1, '3行下へ移動する');
});

test('DXY0: 16x16 スプライト', () => {
  const m = run(`
    LD I, sprite
    LD V0, 0
    LD V1, 0
    DRW V0, V1, 0
    EXIT
    sprite: DW 0xFFFF, 0x0001
  `);
  eq(m.pixel(0, 0), 1, '1行目左端');
  eq(m.pixel(15, 0), 1, '1行目右端（16px幅）');
  eq(m.pixel(15, 1), 1, '2行目は最下位ビットのみ');
  eq(m.pixel(14, 1), 0, '2行目の隣は消灯');
});

// ---------------------------------------------------------------- 入力
test('FX0A: キーは「押して離す」まで待つ', () => {
  const { bytes } = assemble(`
    LD V0, K
    LD V1, 0xAB
    EXIT
  `);
  const m = new Chip8();
  m.loadRom(bytes);
  m.step();                       // FX0A 実行 → 待機状態へ
  assert(m.waitingForKey, '待機状態に入る');
  m.step(); m.step();
  eq(m.v[1], 0, 'キーがなければ先へ進まない');

  m.setKey(7, true);
  m.step();
  eq(m.v[1], 0, '押しただけではまだ進まない');
  m.setKey(7, false);
  m.step();
  assert(!m.waitingForKey, '離した時点で待機解除');
  eq(m.v[0], 7, '押されたキー番号が入る');
  m.step();
  eq(m.v[1], 0xab, '後続命令が実行される');
});

test('EX9E/EXA1: キー状態でスキップする', () => {
  const { bytes } = assemble(`
    LD V0, 5
    SKP V0
    LD V1, 0xFF
    LD V2, 0x11
    EXIT
  `);
  const m = new Chip8();
  m.loadRom(bytes);
  m.setKey(5, true);
  for (let i = 0; i < 5 && !m.halted; i++) m.step();
  eq(m.v[1], 0, 'キーが押されているので次命令をスキップ');
  eq(m.v[2], 0x11, 'その次は実行される');
});

// ---------------------------------------------------------------- 異常系
test('未知の命令でエラー停止する（無限ループしない）', () => {
  const m = run(`
    DW 0x5001      ; 5XY0 の下位ニブルが 0 でない → 未定義
    DW 0x8009      ; 8xy9 は未定義
    EXIT
  `, { cycles: 8 });
  assert(m.halted, '停止する');
  assert(m.error !== null, 'エラーメッセージが設定される');
});

test('空スタックからの RET はエラーになる', () => {
  const m = run(`RET`, { cycles: 4 });
  assert(m.halted && /スタック/.test(m.error), `エラー内容: ${m.error}`);
});

test('スタックオーバーフローを検出する', () => {
  const m = run(`
    loop: CALL loop
  `, { cycles: 64 });
  assert(m.halted && /オーバーフロー/.test(m.error), `エラー内容: ${m.error}`);
});

// ---------------------------------------------------------------- 逆アセンブラ
test('逆アセンブラが主要命令を復元する', () => {
  eq(disassemble(0x00e0), 'CLS');
  eq(disassemble(0x00ee), 'RET');
  eq(disassemble(0x1234), 'JP $234');
  eq(disassemble(0x6a05), 'LD VA, #05');
  eq(disassemble(0xd125), 'DRW V1, V2, 5');
  eq(disassemble(0xf018), 'LD ST, V0');
  eq(disassemble(0xa123), 'LD I, $123');
});

// ---------------------------------------------------------------- 同梱ROM
test('同梱ROMが実行時エラーなく動く', () => {
  const romsPath = join(ROOT, 'assets/js/chip8-roms.js');
  if (!existsSync(romsPath)) throw new Error('chip8-roms.js が未生成です（node scripts/build-chip8-roms.mjs を実行）');
  const { CHIP8_ROMS } = require(romsPath);
  assert(CHIP8_ROMS.length > 0, 'ROMが1本以上ある');

  for (const rom of CHIP8_ROMS) {
    const bytes = Uint8Array.from(rom.hex.match(/../g).map((h) => parseInt(h, 16)));
    const quirks = { ...QUIRK_PRESETS[rom.quirks || 'chip8'] };
    const m = new Chip8({ quirks });
    m.loadRom(bytes);

    // 60フレーム(=約1秒)動かす。途中でキー入力も与えて分岐を踏ませる
    for (let frame = 0; frame < 60; frame++) {
      if (frame === 20) m.setKey(0x6, true);
      if (frame === 30) { m.setKey(0x6, false); m.setKey(0x4, true); }
      if (frame === 40) m.setKey(0x4, false);
      m.runFrame(rom.ipf || 15);
      if (m.error) throw new Error(`${rom.id}: ${m.error} (frame ${frame}, PC=${m.pc.toString(16)})`);
    }
    assert(!m.error, `${rom.id} はエラーなく動作する`);

    // 何かしら画面に描かれていること（真っ黒のままなら実質動いていない）
    const lit = m.display.reduce((a, b) => a + b, 0);
    assert(lit > 0, `${rom.id}: 60フレーム後に画面が真っ黒（描画されていない）`);
  }
});

// ---------------------------------------------------------------- 結果
const total = passed + failures.length;
if (failures.length) {
  console.error(`\n✗ ${failures.length}/${total} 件が失敗しました\n`);
  for (const f of failures) console.error(`  ✗ ${f.name}\n    ${f.message.replace(/\n/g, '\n    ')}\n`);
  process.exit(1);
}
console.log(`✓ CHIP-8 コアテスト: ${passed}/${total} 件すべて成功`);
