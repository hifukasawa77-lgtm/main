(function () {
  'use strict';
  var VAULT = 'receiptOCR.encrypted.v2';
  var LEGACY = ['receiptOCR.ledger.v1', 'receiptOCR.draft.v1', 'receiptOCR.budget.v1', 'receiptOCR.userCat.v1'];
  var session = null, queue = Promise.resolve(), timer, storageError = null, startingRaw, pending = 0, picking = false, pickerTimer;
  var $ = function (id) { return document.getElementById(id); };
  function status(message) { $('vault-status').textContent = message; }
  function gate() { document.querySelectorAll('dialog[open]').forEach(function (dialog) { dialog.close(); }); $('backup-password').value = ''; document.body.classList.add('vault-locked'); $('vault-gate').hidden = false; }
  function queueSave() {
    if (!session) throw new Error('家計簿はロックされています');
    pending++;
    var snapshot = JSON.parse(JSON.stringify(session.state)), key = session.key, salt = session.salt;
    queue = queue.catch(function () {}).then(async function () {
      // Another tab must not overwrite a newer encrypted vault.
      if (localStorage.getItem(VAULT) !== startingRaw) throw new Error('別のタブで家計簿が変更されました。再読み込みしてください');
      var envelope = await ReceiptCrypto.seal(snapshot, key, salt);
      var raw = JSON.stringify(envelope); localStorage.setItem(VAULT, raw); startingRaw = raw;
      storageError = null; $('vault-save-status').textContent = '';
    }).catch(function (error) {
      storageError = error;
      $('vault-save-status').textContent = '暗号化保存に失敗しました。画面を閉じずに空き容量・他のタブを確認してください。';
      throw error;
    }).finally(function () { pending--; });
    queue.catch(function () {});
    return queue;
  }
  async function flush() { await queue; if (storageError) throw storageError; }
  async function lock() {
    if (!session) return;
    gate(); status('保存してロックしています…');
    try {
      if (window.__receiptSaveDraft) window.__receiptSaveDraft();
      await flush(); session = null; location.reload();
    } catch (error) {
      status('保存に失敗したため、ページを閉じないでください。' + error.message);
      $('vault-form').hidden = true; $('vault-retry').hidden = false;
    }
  }
  function touch() { clearTimeout(timer); timer = setTimeout(lock, 5 * 60 * 1000); }
  async function requestBackupPassword() {
    var dialog = $('backup-password-dialog'); $('backup-password').value = ''; dialog.returnValue = ''; dialog.showModal();
    return new Promise(function (resolve) {
      dialog.addEventListener('close', function () {
        var password = dialog.returnValue === 'unlock' ? $('backup-password').value : null;
        $('backup-password').value = ''; resolve(password);
      }, { once: true });
    });
  }
  async function open() {
    gate();
    if (!globalThis.crypto || !crypto.subtle) { status('暗号化に対応したHTTPSのブラウザが必要です。'); $('vault-submit').disabled = true; return new Promise(function () {}); }
    try { startingRaw = localStorage.getItem(VAULT); }
    catch (error) { status('ブラウザの保存領域を利用できません。サイトデータの保存を許可してください。'); $('vault-submit').disabled = true; return new Promise(function () {}); }
    var creating = !startingRaw;
    $('vault-title').textContent = creating ? '家計簿を安全に保存' : '家計簿のロックを解除';
    $('vault-submit').textContent = creating ? 'パスワードを設定 / Set password' : 'ロック解除 / Unlock';
    $('vault-confirm-label').hidden = !creating;
    $('vault-password').autocomplete = creating ? 'new-password' : 'current-password';
    $('vault-help').textContent = creating ? '12文字以上のパスワードを設定してください。既存の記録と下書きも暗号化して引き継ぎます。' : '設定したパスワードを入力してください。';
    return new Promise(function (resolve) {
      $('vault-form').addEventListener('submit', async function (event) {
        event.preventDefault(); var password = $('vault-password').value;
        if (creating && (password.length < 12 || password !== $('vault-confirm').value)) { status('12文字以上で、確認欄にも同じパスワードを入力してください。'); return; }
        $('vault-submit').disabled = true; status('暗号化データを処理しています…');
        try {
          if (creating) {
            var salt = crypto.getRandomValues(new Uint8Array(16)), values = {};
            LEGACY.forEach(function (key) { var value = localStorage.getItem(key); if (value !== null) values[key] = value; });
            session = { key: await ReceiptCrypto.derive(password, salt), salt: salt, state: { app: 'receipt-ocr-ledger', version: 2, values: values } };
            await queueSave();
            // Remove plaintext only after encrypted storage has succeeded.
            LEGACY.forEach(function (key) { localStorage.removeItem(key); });
          } else session = await ReceiptCrypto.unlock(JSON.parse(startingRaw), password);
          LEGACY.forEach(function (key) { localStorage.removeItem(key); });
          $('vault-password').value = ''; $('vault-confirm').value = ''; status('');
          document.body.classList.remove('vault-locked'); $('vault-gate').hidden = true;
          ['pointerdown', 'keydown', 'input'].forEach(function (eventName) { document.addEventListener(eventName, touch, { passive: true }); }); touch();
          document.addEventListener('visibilitychange', function () {
            if (document.hidden && !picking) lock();
            if (!document.hidden && picking) setTimeout(endFileSelection, 1000);
          });
          window.addEventListener('beforeunload', function (event) { if (pending) { event.preventDefault(); event.returnValue = ''; } });
          window.addEventListener('pagehide', function () { session = null; });
          window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });
          resolve(Object.freeze({
            getItem: function (key) { if (!session) return null; return session.state.values[key] ?? null; },
            setItem: function (key, value) { if (!session) throw new Error('Locked'); session.state.values[key] = String(value); queueSave(); },
            removeItem: function (key) { if (!session) throw new Error('Locked'); delete session.state.values[key]; queueSave(); },
            flush: flush,
            backup: async function () { await flush(); return startingRaw; },
            restoreData: async function (text) {
              var data = JSON.parse(text);
              if (data.format === ReceiptCrypto.FORMAT) {
                var password = await requestBackupPassword(); if (password === null) throw new Error('Cancelled');
                var result = await ReceiptCrypto.unlock(data, password);
                return { entries: JSON.parse(result.state.values['receiptOCR.ledger.v1'] || '[]'), encryptedValues: result.state.values };
              }
              return data; // Older plaintext backups can be imported into the encrypted vault.
            }
          }));
        } catch (error) {
          session = null;
          status(creating ? '暗号化保存に失敗しました。既存データは削除しません。保存領域と他のタブを確認してください。' : 'パスワードが違うか、暗号化データを読み込めません。');
        } finally { $('vault-submit').disabled = false; }
      });
    });
  }
  $('vault-lock').addEventListener('click', lock);
  $('vault-retry').addEventListener('click', async function () { try { await queueSave(); await flush(); session = null; location.reload(); } catch (error) { status('保存に失敗しました。' + error.message); } });
  // Native camera/file pickers temporarily hide mobile browsers; allow their result
  // to return, but never leave this exception active for more than two minutes.
  function beginFileSelection() {
    picking = true; clearTimeout(pickerTimer);
    pickerTimer = setTimeout(function () { picking = false; if (document.hidden) lock(); }, 120000);
  }
  function endFileSelection() { picking = false; clearTimeout(pickerTimer); }
  window.ReceiptVault = Object.freeze({ open: open, beginFileSelection: beginFileSelection, endFileSelection: endFileSelection });
})();
