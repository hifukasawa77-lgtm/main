// ステージ開始時のチェックポイント。保存領域が使えなくてもゲームは続行する。
(function (K) {
  const KEY = 'koma-ken.checkpoint.v1';
  const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  function valid(s) {
    return s && s.version === 1 && K.STAGE_LIST.some(stage => stage.id === s.stageId) &&
      integer(s.score, 0, Number.MAX_SAFE_INTEGER) && integer(s.lives, 0, 999999) &&
      integer(s.selectIndex, 0, K.SELECT.length - 1) && s.auto &&
      Object.keys(K.AUTO).every(id => Object.hasOwn(s.auto, id) && integer(s.auto[id], 0, 9)) &&
      Array.isArray(s.single) && s.single.length <= 6 && s.single.every(id => Object.hasOwn(K.SINGLE, id));
  }
  K.SaveStore = {
    read() {
      try { const s = JSON.parse(window.localStorage.getItem(KEY)); return valid(s) ? s : null; }
      catch (e) { return null; }
    },
    write(s) {
      if (!valid(s)) return false;
      try { window.localStorage.setItem(KEY, JSON.stringify(s)); return true; }
      catch (e) { return false; }
    },
    clear() {
      try { window.localStorage.removeItem(KEY); return true; }
      catch (e) { return false; }
    },
  };
})(window.KOMA);
