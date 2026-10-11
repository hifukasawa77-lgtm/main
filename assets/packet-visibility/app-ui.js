(() => {
  'use strict';
  const body = document.body;
  const buttons = [...document.querySelectorAll('.app-nav [data-view]')];
  const action = document.getElementById('mobileAction');
  const mobile = matchMedia('(max-width:700px)');
  const targets = {diagnosis:'diagBtn',monitor:'toggleBtn',settings:'toggleBtn',records:'exportBtn'};
  let tab = 'diagnosis';
  function syncAction() {
    const target = document.getElementById(targets[tab]);
    action.disabled = target.disabled;
    action.textContent = tab === 'diagnosis' ? (target.disabled ? '診断中… / Checking…' : '無料診断スタート / Start check') : tab === 'records' ? 'CSVを保存 / Export CSV' : target.textContent;
    action.classList.toggle('stop', target.classList.contains('stop'));
  }
  function render() {
    if (mobile.matches) body.dataset.appTab = tab;
    else delete body.dataset.appTab;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === tab)));
    syncAction();
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    tab = button.dataset.view;
    render();
    window.scrollTo({top:0,behavior:'instant'});
  }));
  action.addEventListener('click', () => document.getElementById(targets[tab]).click());
  const observer = new MutationObserver(syncAction);
  Object.values(targets).forEach(id => observer.observe(document.getElementById(id), {attributes:true,childList:true,subtree:true}));
  mobile.addEventListener('change', render);
  render();
})();
