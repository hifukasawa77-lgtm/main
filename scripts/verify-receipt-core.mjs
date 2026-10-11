#!/usr/bin/env node
// Network/browser-free checks of the actual inline parser and ledger rendering.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../receipt-ocr.html', import.meta.url), 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function parseReceipt'));
new vm.Script(source); // Check the entire production script, not just extracted functions.
const fn = name => {
  const start = source.indexOf('    function ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n    }', start) + 6);
};
const values = new Map();
function element() {
  return { style: {}, attributes: {}, children: [], textContent: '', classList: { toggle() {} },
    appendChild(e) { this.children.push(e); return e; },
    setAttribute(k, v) { this.attributes[k] = v; },
    get firstElementChild() { return this.children[0]; } };
}
const nodes = new Map();
const $ = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
$('st-budget-bar').appendChild(element());
const ctx = vm.createContext({ console, $, document: { createElement: element, createElementNS: element },
  secureStorage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) } });
const categories = source.slice(source.indexOf('    var CATS ='), source.indexOf('    function loadImage('));
vm.runInContext(categories + '\n' + ['itemsSum','monthTotals','shiftMonth','pad2','loadLedger','validEntry','renderLedger','renderSpendingCharts','categoryIcon','el','evaluate'].map(fn).join('\n') + `
var LEDGER_KEY='receiptOCR.ledger.v1', BUDGET_KEY='receiptOCR.budget.v1', ledgerMonth='2026-09';
var yen=function(n){return (n<0?'−¥':'¥')+Math.abs(n||0).toLocaleString('ja-JP');};
function entryView(e){return e;}
`, ctx);
const fixtures = fs.readFileSync(new URL('./verify-receipt-ocr.mjs', import.meta.url), 'utf8');
vm.runInContext(fixtures.slice(fixtures.indexOf('const RAW_A ='), fixtures.indexOf('// 偽のOCRエンジン')), ctx);
let checks = 0;
function test(name, expr) { assert.ok(vm.runInContext(expr, ctx), name); checks++; console.log('PASS ' + name); }
test('丸数字・通貨の正規化', `normalizeLine('\\\\②, 0①④') === '¥2,014'`);
test('OCR文字から8明細を抽出', 'parseReceipt(RAW_A).items.length === 8');
test('数量と単価を識別', 'parseReceipt(RAW_A).items.some(i=>/たまご/.test(i.name)&&i.qty===2&&i.price===258)');
test('値引を正しく差し引く', 'parseReceipt(RAW_A).items.some(i=>i.price===-100&&i.cat==="肉類")');
test('外税込み合計2175円', 'evaluate(toLines(RAW_A)).totals.total===2175 && evaluate(toLines(RAW_A)).totals.taxOut===161 && evaluate(toLines(RAW_A)).ok');
test('店名と購入日を抽出', 'detectMeta(RAW_A).store==="フレッシュマート青葉台店" && detectMeta(RAW_A).date==="2026-09-20"');
test('和暦を認識', 'detectMeta(RAW_C).date==="2026-09-15"');
test('数量明細と外税の別パターン', 'evaluate(toLines(RAW_C)).totals.total===2758 && evaluate(toLines(RAW_C)).ok');
test('合計なしでも支払いと釣銭から算出', `detectTotal('※パン ¥300\\n※牛乳 ¥200\\nお預り ¥1,000\\nお釣り ¥500')===500`);
test('価格なしでは明細を作らない', 'parseReceipt("品目だけ").items.length===0');
test('シンプルな貼り付け文字の抽出', `evaluate(toLines('○○スーパー\\n2026年10月4日\\n牛乳 ¥238\\n食パン ¥158\\n合計 ¥396')).ok`);
test('カテゴリー自動分類', 'classify("牛乳")==="乳製品・卵" && classify("食パン")==="パン・米・麺"');
vm.runInContext(`var p=evaluate(toLines(RAW_A)); var entry={id:'test',date:'2026-09-20',store:'テスト',items:p.items.map(i=>({...i,cat:i.cat||classify(i.name)})),tax:p.totals.taxOut}; secureStorage.setItem(LEDGER_KEY,JSON.stringify([entry])); secureStorage.setItem(BUDGET_KEY,'3000'); renderLedger();`, ctx);
test('家計簿の月別支出を表示', `$('st-total').textContent==='¥2,175' && $('st-count').textContent===1`);
test('予算の残りを表示', `$('st-budget').textContent==='¥825'`);
test('保存済みの品目からグラフを描画', `$('category-chart').style.background.startsWith('conic-gradient(') && $('category-chart').attributes['aria-label'].includes('肉類')`);
test('カテゴリー別合計と支払額の一致', 'Object.values(monthTotals(loadLedger(),ledgerMonth).cats).reduce((a,b)=>a+b,0)===2175');
vm.runInContext("ledgerMonth='2026-10';renderLedger()", ctx);
test('記録のない月はグラフを空にする', `$('chart-count').textContent==='¥0' && $('category-chart').style.background==='var(--chart-empty)' && $('st-total').textContent==='¥0'`);
test('年をまたぐ月移動', 'shiftMonth("2026-12",1)==="2027-01" && shiftMonth("2026-01",-1)==="2025-12"');
console.log(`PASS ${checks} checks + full JavaScript syntax`);
