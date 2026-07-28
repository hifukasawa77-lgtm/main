#!/usr/bin/env node
/**
 * CHIP-8 アセンブラ / CHIP-8 assembler
 *
 * chip8.html に同梱する自作ROMを、可読なアセンブリソース（.c8asm）から
 * バイナリへ変換する。外部ライブラリ・ビルドツールは不使用。
 *
 * 使い方 / Usage:
 *   node scripts/chip8-asm.mjs scripts/roms/dodge.c8asm -o dodge.ch8
 *   node scripts/chip8-asm.mjs scripts/roms/dodge.c8asm --hex
 *
 * 文法 / Syntax:
 *   ; コメント
 *   NAME EQU 0x10          定数定義
 *   ORG  0x200             出力開始アドレス（既定 0x200）
 *   label:                 ラベル
 *   DB 0xF0, 0x90          バイト列
 *   DW 0x1234              ワード列（ビッグエンディアン）
 *   CLS / RET / JP / CALL / SE / SNE / LD / ADD / OR / AND / XOR /
 *   SUB / SHR / SUBN / SHL / RND / DRW / SKP / SKNP
 */

const REG_RE = /^v([0-9a-f])$/i;

class AsmError extends Error {
  constructor(msg, lineNo, text) {
    super(`行 ${lineNo}: ${msg}\n  > ${text}`);
    this.name = 'AsmError';
    this.lineNo = lineNo;
  }
}

/** "V3" → 3、レジスタでなければ null */
function reg(tok) {
  const m = REG_RE.exec(tok);
  return m ? parseInt(m[1], 16) : null;
}

/** ソース1行を { label, op, args } に分解する */
function tokenize(rawLine) {
  // ';' 以降はコメント
  const line = rawLine.replace(/;.*$/, '').trim();
  if (!line) return null;

  let rest = line;
  let label = null;
  const labelMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*/.exec(rest);
  if (labelMatch) {
    label = labelMatch[1];
    rest = rest.slice(labelMatch[0].length).trim();
    if (!rest) return { label, op: null, args: [] };
  }

  // "NAME EQU value" 形式（ラベル記法ではないので個別に拾う）
  const equMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s+EQU\s+(.+)$/i.exec(rest);
  if (equMatch) return { label, op: 'EQU', args: [equMatch[1], equMatch[2].trim()] };

  const spaceIdx = rest.search(/\s/);
  const op = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toUpperCase();
  const argStr = spaceIdx === -1 ? '' : rest.slice(spaceIdx).trim();
  const args = argStr ? argStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return { label, op, args };
}

/** 命令/ディレクティブが占めるバイト数（ラベル解決前に確定する必要がある） */
function sizeOf(item) {
  if (item.op === 'DB') return item.args.length;
  if (item.op === 'DW') return item.args.length * 2;
  return 2; // CHIP-8 命令はすべて2バイト固定
}

export function assemble(source, opts = {}) {
  const lines = source.split(/\r?\n/);
  const symbols = new Map();
  const items = [];
  let addr = opts.origin ?? 0x200;

  // --- パス1: アドレス割り当て・ラベル/定数の収集 ---
  for (let i = 0; i < lines.length; i++) {
    const t = tokenize(lines[i]);
    if (!t) continue;
    const lineNo = i + 1;
    const text = lines[i].trim();

    if (t.label) {
      if (symbols.has(t.label)) throw new AsmError(`ラベル ${t.label} が重複しています`, lineNo, text);
      symbols.set(t.label, addr);
    }
    if (!t.op) continue;

    if (t.op === 'EQU') {
      // 定数は前方参照させない（パス1で即座に評価する）
      symbols.set(t.args[0], evalExpr(t.args[1], symbols, lineNo, text));
      continue;
    }
    if (t.op === 'ORG') {
      addr = evalExpr(t.args[0], symbols, lineNo, text);
      continue;
    }

    // 命令は2バイト境界に載っていなければならない（DB の奇数バイトで容易にズレる）
    if (t.op !== 'DB' && t.op !== 'DW' && addr % 2 !== 0) {
      throw new AsmError(`命令が奇数アドレス ${hex(addr, 3)} にあります（DB のバイト数を偶数に揃えてください）`, lineNo, text);
    }

    const item = { ...t, addr, lineNo, text };
    items.push(item);
    addr += sizeOf(item);
    if (addr > 0x1000) throw new AsmError('4KBのメモリ空間を超えました', lineNo, text);
  }

  // --- パス2: エンコード ---
  const origin = opts.origin ?? 0x200;
  const end = items.length ? Math.max(...items.map((it) => it.addr + sizeOf(it))) : origin;
  const out = new Uint8Array(end - origin);
  for (const item of items) {
    const bytes = encode(item, symbols);
    out.set(bytes, item.addr - origin);
  }
  return { bytes: out, symbols, origin };
}

function hex(n, w = 2) {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w, '0');
}

/** 数値リテラル・ラベル・単純な加減算 (label+2) を評価する */
function evalExpr(tok, symbols, lineNo, text) {
  const parts = tok.split(/([+\-])/).map((s) => s.trim()).filter(Boolean);
  let value = null;
  let sign = 1;
  for (const p of parts) {
    if (p === '+') { sign = 1; continue; }
    if (p === '-') { sign = -1; continue; }
    const v = evalAtom(p, symbols, lineNo, text);
    value = value === null ? v : value + sign * v;
  }
  if (value === null) throw new AsmError(`式を評価できません: ${tok}`, lineNo, text);
  return value;
}

function evalAtom(tok, symbols, lineNo, text) {
  if (/^0x[0-9a-f]+$/i.test(tok)) return parseInt(tok.slice(2), 16);
  if (/^0b[01]+$/i.test(tok)) return parseInt(tok.slice(2), 2);
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  if (symbols.has(tok)) return symbols.get(tok);
  throw new AsmError(`未定義のシンボル: ${tok}`, lineNo, text);
}

function encode(item, symbols) {
  const { op, args, lineNo, text } = item;
  const num = (tok) => evalExpr(tok, symbols, lineNo, text);
  const need = (n) => {
    if (args.length !== n) throw new AsmError(`${op} はオペランド${n}個が必要です（${args.length}個指定）`, lineNo, text);
  };
  const word = (w) => [(w >> 8) & 0xff, w & 0xff];
  const nnn = (tok) => {
    const v = num(tok);
    if (v < 0 || v > 0xfff) throw new AsmError(`アドレスが範囲外です: ${hex(v, 3)}`, lineNo, text);
    return v;
  };
  const kk = (tok) => {
    const v = num(tok);
    if (v < -128 || v > 0xff) throw new AsmError(`8bit値が範囲外です: ${v}`, lineNo, text);
    return v & 0xff;
  };

  switch (op) {
    case 'DB':
      return args.map((a) => kk(a));
    case 'DW':
      return args.flatMap((a) => word(num(a) & 0xffff));

    case 'CLS': need(0); return word(0x00e0);
    case 'RET': need(0); return word(0x00ee);
    case 'EXIT': need(0); return word(0x00fd);   // SUPER-CHIP
    case 'LOW': need(0); return word(0x00fe);    // SUPER-CHIP: 64x32
    case 'HIGH': need(0); return word(0x00ff);   // SUPER-CHIP: 128x64

    case 'SCD': need(1); return word(0x00c0 | (num(args[0]) & 0x0f));
    case 'SCR': need(0); return word(0x00fb);
    case 'SCL': need(0); return word(0x00fc);

    case 'SYS': need(1); return word(0x0000 | nnn(args[0]));

    case 'JP': {
      if (args.length === 2) {
        if (reg(args[0]) !== 0) throw new AsmError('JP の2オペランド形式は V0 のみです', lineNo, text);
        return word(0xb000 | nnn(args[1]));
      }
      need(1);
      return word(0x1000 | nnn(args[0]));
    }
    case 'CALL': need(1); return word(0x2000 | nnn(args[0]));

    case 'SE': {
      need(2);
      const x = reg(args[0]);
      if (x === null) throw new AsmError('SE の第1オペランドはVレジスタです', lineNo, text);
      const y = reg(args[1]);
      return y === null ? word(0x3000 | (x << 8) | kk(args[1])) : word(0x5000 | (x << 8) | (y << 4));
    }
    case 'SNE': {
      need(2);
      const x = reg(args[0]);
      if (x === null) throw new AsmError('SNE の第1オペランドはVレジスタです', lineNo, text);
      const y = reg(args[1]);
      return y === null ? word(0x4000 | (x << 8) | kk(args[1])) : word(0x9000 | (x << 8) | (y << 4));
    }

    case 'LD': {
      need(2);
      const [d, s] = args;
      const dn = d.toUpperCase();
      const sn = s.toUpperCase();
      const dx = reg(d);
      const sy = reg(s);

      if (dn === 'I') return word(0xa000 | nnn(s));                        // LD I, addr
      if (dn === 'DT' && sy !== null) return word(0xf015 | (sy << 8));     // LD DT, Vx
      if (dn === 'ST' && sy !== null) return word(0xf018 | (sy << 8));     // LD ST, Vx
      if (dn === 'F' && sy !== null) return word(0xf029 | (sy << 8));      // LD F, Vx
      if (dn === 'HF' && sy !== null) return word(0xf030 | (sy << 8));     // LD HF, Vx (SUPER-CHIP)
      if (dn === 'B' && sy !== null) return word(0xf033 | (sy << 8));      // LD B, Vx
      if (dn === '[I]' && sy !== null) return word(0xf055 | (sy << 8));    // LD [I], Vx
      if (dn === 'R' && sy !== null) return word(0xf075 | (sy << 8));      // LD R, Vx (SUPER-CHIP)

      if (dx !== null) {
        if (sy !== null) return word(0x8000 | (dx << 8) | (sy << 4));      // LD Vx, Vy
        if (sn === 'DT') return word(0xf007 | (dx << 8));                  // LD Vx, DT
        if (sn === 'K') return word(0xf00a | (dx << 8));                   // LD Vx, K
        if (sn === '[I]') return word(0xf065 | (dx << 8));                 // LD Vx, [I]
        if (sn === 'R') return word(0xf085 | (dx << 8));                   // LD Vx, R
        return word(0x6000 | (dx << 8) | kk(s));                           // LD Vx, byte
      }
      throw new AsmError(`LD の形式を解釈できません: LD ${d}, ${s}`, lineNo, text);
    }

    case 'ADD': {
      need(2);
      const [d, s] = args;
      const dx = reg(d);
      const sy = reg(s);
      if (d.toUpperCase() === 'I' && sy !== null) return word(0xf01e | (sy << 8)); // ADD I, Vx
      if (dx === null) throw new AsmError('ADD の第1オペランドが不正です', lineNo, text);
      return sy === null ? word(0x7000 | (dx << 8) | kk(s)) : word(0x8004 | (dx << 8) | (sy << 4));
    }

    case 'OR':
    case 'AND':
    case 'XOR':
    case 'SUB':
    case 'SUBN': {
      need(2);
      const x = reg(args[0]);
      const y = reg(args[1]);
      if (x === null || y === null) throw new AsmError(`${op} は Vx, Vy 形式です`, lineNo, text);
      const sub = { OR: 1, AND: 2, XOR: 3, SUB: 5, SUBN: 7 }[op];
      return word(0x8000 | (x << 8) | (y << 4) | sub);
    }

    case 'SHR':
    case 'SHL': {
      // SHR Vx / SHR Vx, Vy の両方を許可（Vy 省略時は Vy=Vx）
      const x = reg(args[0]);
      if (x === null) throw new AsmError(`${op} の第1オペランドはVレジスタです`, lineNo, text);
      const y = args.length > 1 ? reg(args[1]) : x;
      if (y === null) throw new AsmError(`${op} の第2オペランドはVレジスタです`, lineNo, text);
      return word(0x8000 | (x << 8) | (y << 4) | (op === 'SHR' ? 6 : 0xe));
    }

    case 'RND': {
      need(2);
      const x = reg(args[0]);
      if (x === null) throw new AsmError('RND の第1オペランドはVレジスタです', lineNo, text);
      return word(0xc000 | (x << 8) | kk(args[1]));
    }

    case 'DRW': {
      need(3);
      const x = reg(args[0]);
      const y = reg(args[1]);
      if (x === null || y === null) throw new AsmError('DRW は Vx, Vy, nibble 形式です', lineNo, text);
      const n = num(args[2]);
      if (n < 0 || n > 15) throw new AsmError(`DRW の高さが範囲外です: ${n}`, lineNo, text);
      return word(0xd000 | (x << 8) | (y << 4) | n);
    }

    case 'SKP':
    case 'SKNP': {
      need(1);
      const x = reg(args[0]);
      if (x === null) throw new AsmError(`${op} のオペランドはVレジスタです`, lineNo, text);
      return word((op === 'SKP' ? 0xe09e : 0xe0a1) | (x << 8));
    }

    default:
      throw new AsmError(`未知のニーモニック: ${op}`, lineNo, text);
  }
}

// --- CLI ---
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const argv = process.argv.slice(2);
  const input = argv.find((a) => !a.startsWith('-'));
  if (!input) {
    console.error('使い方: node scripts/chip8-asm.mjs <input.c8asm> [-o out.ch8] [--hex]');
    process.exit(1);
  }
  try {
    const { bytes, symbols } = assemble(readFileSync(input, 'utf8'));
    const oIdx = argv.indexOf('-o');
    if (oIdx !== -1 && argv[oIdx + 1]) {
      writeFileSync(argv[oIdx + 1], bytes);
      console.error(`書き出し: ${argv[oIdx + 1]} (${bytes.length} bytes)`);
    }
    if (argv.includes('--hex') || oIdx === -1) {
      console.log(Buffer.from(bytes).toString('hex'));
    }
    if (argv.includes('--symbols')) {
      for (const [k, v] of symbols) console.error(`  ${k} = ${hex(v, 3)}`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
