// Whitelist rules use IDs starting at 10001 to avoid conflict with static rules (1-100)
async function getWhitelist() {
  const { whitelist } = await chrome.storage.local.get('whitelist');
  return whitelist || {};  // { "domain.com": ruleId }
}

async function addToWhitelist(domain) {
  const whitelist = await getWhitelist();
  if (domain in whitelist) return;

  const existingIds = Object.values(whitelist);
  const ruleId = existingIds.length === 0 ? 10001 : Math.max(...existingIds) + 1;
  whitelist[domain] = ruleId;

  await chrome.storage.local.set({ whitelist });
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [{
      id: ruleId,
      priority: 2,
      action: { type: 'allowAllRequests' },
      condition: {
        urlFilter: `||${domain}`,
        resourceTypes: ['main_frame', 'sub_frame']
      }
    }]
  });
}

async function removeFromWhitelist(domain) {
  const whitelist = await getWhitelist();
  const ruleId = whitelist[domain];
  if (!ruleId) return;

  delete whitelist[domain];
  await chrome.storage.local.set({ whitelist });
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleId]
  });
}

// Restore dynamic whitelist rules on browser startup (service worker may be killed)
chrome.runtime.onStartup.addListener(async () => {
  const whitelist = await getWhitelist();
  const rules = Object.entries(whitelist).map(([domain, ruleId]) => ({
    id: ruleId,
    priority: 2,
    action: { type: 'allowAllRequests' },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ['main_frame', 'sub_frame']
    }
  }));
  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    getWhitelist().then(whitelist => {
      sendResponse({ whitelisted: message.domain in whitelist, whitelist: Object.keys(whitelist) });
    });
    return true;
  }

  if (message.type === 'TOGGLE_WHITELIST') {
    getWhitelist().then(async (whitelist) => {
      if (message.domain in whitelist) {
        await removeFromWhitelist(message.domain);
        sendResponse({ whitelisted: false });
      } else {
        await addToWhitelist(message.domain);
        sendResponse({ whitelisted: true });
      }
    });
    return true;
  }

  if (message.type === 'REMOVE_FROM_WHITELIST') {
    removeFromWhitelist(message.domain).then(() => sendResponse({ ok: true }));
    return true;
  }
});
