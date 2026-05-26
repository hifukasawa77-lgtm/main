function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    // Handle country-code TLDs like co.uk, ne.jp (3+ parts)
    if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function renderWhitelist(domains, currentDomain) {
  const section = document.getElementById('whitelistSection');
  const list = document.getElementById('whitelistItems');
  const count = document.getElementById('whitelistCount');

  count.textContent = domains.length;

  if (domains.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = '';

  domains.forEach(domain => {
    const li = document.createElement('li');
    li.className = 'whitelist-item';

    const span = document.createElement('span');
    span.textContent = domain;

    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.title = '許可を解除';
    btn.textContent = '×';
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'REMOVE_FROM_WHITELIST', domain });
      li.remove();
      const remaining = list.querySelectorAll('li').length;
      count.textContent = remaining;
      if (remaining === 0) section.style.display = 'none';
      if (domain === currentDomain) updateToggleButton(false, currentDomain);
    });

    li.appendChild(span);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function updateToggleButton(whitelisted, domain) {
  const btn = document.getElementById('toggleBtn');
  const text = document.getElementById('toggleText');
  const statusText = document.getElementById('statusText');

  btn.disabled = false;

  if (whitelisted) {
    btn.className = 'toggle-btn block';
    text.textContent = 'このサイトの遮断を再開';
    statusText.textContent = '遮断を一時停止中';
    statusText.className = 'paused';
  } else {
    btn.className = 'toggle-btn allow';
    text.textContent = 'このサイトを許可リストに追加';
    statusText.textContent = '保護中';
    statusText.className = '';
  }
}

async function init() {
  const tab = await getCurrentTab();
  const domain = tab?.url ? extractDomain(tab.url) : null;

  const domainEl = document.getElementById('domain');
  const toggleBtn = document.getElementById('toggleBtn');

  if (!domain || !tab.url.startsWith('http')) {
    domainEl.textContent = '対象外のページ';
    toggleBtn.disabled = true;
    document.getElementById('toggleText').textContent = '—';
    return;
  }

  domainEl.textContent = domain;

  const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS', domain });
  updateToggleButton(response.whitelisted, domain);
  renderWhitelist(response.whitelist, domain);

  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    const res = await chrome.runtime.sendMessage({ type: 'TOGGLE_WHITELIST', domain });
    updateToggleButton(res.whitelisted, domain);

    const statusRes = await chrome.runtime.sendMessage({ type: 'GET_STATUS', domain });
    renderWhitelist(statusRes.whitelist, domain);
  });
}

init();
