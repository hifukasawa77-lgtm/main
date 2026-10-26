// ===== 画像アセットの設定ファイル =====
// ここの src を差し替えるだけで、仮描画（プレースホルダー）から実画像に切り替わる。
//   src: null            → 仮描画で動く（初期状態）
//   src: 'player.webp'   → basePath からの相対パス。読めなければ仮描画へ戻り、理由を status に残す
// スプライトシートは「行=アニメ、列=コマ」。frameW/frameH は1コマの画素数。
// 描画は「足元中央」を基準に置くので、画像も足元中央に揃えて描く（drawW/drawH で表示サイズを変えられる）。
// ※ 画像を足すときは WebP を推奨（CLAUDE.md 画像アセット方針）。
window.KOMA = window.KOMA || {};
(function (K) {
  const anim = (row, frames, fps) => ({ row: row, frames: frames, fps: fps || 8 });
  const walker = (h) => ({ src: null, frameW: 24, frameH: h || 24, anims: { idle: anim(0, 2, 4), walk: anim(1, 4, 8) } });
  const C = {
    basePath: 'assets/koma-ken/img/',
    sprites: {
      player: { src: null, frameW: 32, frameH: 48, drawW: 32, drawH: 48, anims: {
        idle: anim(0, 2, 3), walk: anim(1, 4, 10), jump: anim(2, 1), crouch: anim(3, 1),
        attack: anim(4, 3, 18), crouchAttack: anim(5, 3, 18), hurt: anim(6, 1), dragon: anim(7, 4, 10) } },
      enemy_plain: walker(), enemy_ember: walker(), enemy_frost: walker(), enemy_knight: walker(32),
      enemy_ghoul: walker(28), enemy_naga: walker(),
      enemy_bat: { src: null, frameW: 24, frameH: 16, anims: { idle: anim(0, 2, 6), fly: anim(1, 4, 10) } },
      shot_orb: { src: null, frameW: 8, frameH: 8, anims: { idle: anim(0, 1, 1) } },
      enemy_shot: { src: null, frameW: 8, frameH: 8, anims: { idle: anim(0, 2, 8) } },
      item: { src: null, frameW: 16, frameH: 16, anims: { idle: anim(0, 1, 1) } },
      gate: { src: null, frameW: 48, frameH: 64, anims: { idle: anim(0, 1, 1) } },
    },
    backgrounds: { training: { src: null, parallax: 0.5 }, gate_hub: { src: null }, gate_heaven: { src: null }, gate_hell: { src: null } },
    ui: { title: { src: null }, hud_frame: { src: null }, pause_panel: { src: null }, gameover: { src: null } },
  };
  // ボス13体（ラウンド×ステージ）と、各ステージの背景。フェーズ4で順に実装する。画像だけ先に差し込める
  ['r1s1', 'r1s2', 'r1s3', 'r1s4', 'r2s1', 'r2s2', 'r2s3', 'r2s4', 'r3s1', 'r3s2', 'r3s3', 'r3s4', 'r4s1'].forEach(function (id) {
    C.sprites['boss_' + id] = { src: null, frameW: 64, frameH: 64, anims: { idle: anim(0, 2, 4), attack: anim(1, 4, 10), hurt: anim(2, 1) } };
    C.backgrounds['stage_' + id] = { src: null, parallax: 0.5 };
  });
  K.ASSET_CONFIG = C;
})(window.KOMA);
