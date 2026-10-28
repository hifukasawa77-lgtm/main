// Run with: node scripts/verify-koma-input.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Target {
  handlers = {};
  on = new Set();
  classList = { add: c => this.on.add(c), remove: c => this.on.delete(c) };
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  setPointerCapture() {}
  fire(type, pointerId = 1, detail = 0) {
    for (const fn of this.handlers[type] || []) fn({ type, pointerId, detail, button: 0, preventDefault() {} });
  }
}
const window = new Target(), document = new Target();
const buttons = ['left', 'jump', 'attack', 'pause'].map(action => {
  const b = new Target(); b.dataset = { komaAction: action }; return b;
});
document.querySelectorAll = () => buttons;
window.KOMA = {};
vm.runInNewContext(readFileSync(new URL('../assets/koma-ken/js/input.js', import.meta.url), 'utf8'), { window, document, navigator: {} });
const input = new window.KOMA.Input();
buttons[0].fire('pointerdown', 1);
buttons[1].fire('pointerdown', 2);
buttons[2].fire('pointerdown', 3);
input.update();
assert.ok(input.down.left && input.pressed.jump && input.pressed.attack, 'simultaneous movement, jump and sword');
input.update();
assert.equal(input.pressed.attack, false, 'held button does not repeat pressed edge');
buttons[1].fire('pointercancel', 2);
input.update();
assert.ok(!input.down.jump && input.down.left && input.down.attack, 'cancel releases only its pointer');
buttons[0].fire('lostpointercapture', 1);
input.update();
assert.equal(input.down.left, false, 'lost capture releases direction');
input.set('KeyZ', true);
buttons[2].fire('pointerup', 3);
input.update();
assert.equal(input.down.attack, true, 'touch release preserves keyboard input');
buttons[3].fire('pointerdown', 4);
input.update();
assert.equal(input.pressed.pause, true, 'start/pause edge');
window.fire('blur');
input.update();
assert.ok(Object.values(input.down).every(v => !v), 'blur releases all input');
assert.ok(buttons.every(b => b.on.size === 0), 'blur resets held appearance');
buttons[0].fire('pointerdown', 5);
document.hidden = true;
document.fire('visibilitychange');
input.update();
assert.equal(input.down.left, false, 'hidden document releases input');
document.hidden = false;
buttons[2].fire('pointerdown', 6); buttons[2].fire('pointerup', 6); buttons[2].fire('lostpointercapture', 6);
input.update();
assert.equal(input.pressed.attack, true, 'quick tap between frames is preserved');
input.update();
assert.equal(input.down.attack, false, 'quick tap lasts exactly one update');
buttons[2].fire('pointerdown', 7); buttons[2].fire('pointercancel', 7);
input.update();
assert.equal(input.pressed.attack, false, 'canceled tap is not queued');
buttons[2].fire('pointerdown', 8); buttons[2].fire('lostpointercapture', 8);
input.update();
assert.equal(input.pressed.attack, false, 'unexpected lost capture cancels queued tap');
buttons[3].fire('click'); input.update();
assert.equal(input.pressed.pause, true, 'keyboard or assistive click activates button');
input.update();
buttons[3].fire('click', 1, 1); input.update();
assert.equal(input.pressed.pause, false, 'pointer-generated click does not trigger twice');
for (const type of ['keydown', 'keyup']) for (const fn of window.handlers[type]) fn({ code: 'KeyZ', preventDefault() {} });
input.update();
assert.equal(input.pressed.attack, true, 'keyboard tap between frames is preserved');
input.update();
assert.equal(input.down.attack, false, 'queued keyboard tap lasts exactly one update');
for (const fn of window.handlers.keydown) fn({ code: 'KeyZ', preventDefault() {} });
window.fire('blur'); input.update();
assert.equal(input.down.attack, false, 'blur cancels queued keyboard tap');
console.log('PASS: simultaneous touch, quick taps, keyboard/assistive clicks, pressed edges, cancel, capture loss, keyboard coexistence, pause, blur and visibility');
