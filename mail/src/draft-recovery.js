const prefix = user => 'mail-atlas:recover-draft:' + user + ':';
const textFields = ['account_id', 'to', 'cc', 'bcc', 'subject', 'body', 'body_html', 'reply_id'];

export function draftContent(draft) {
  return Object.fromEntries(textFields.map(field => [field, draft[field] ?? '']));
}

export function hasDraftBody(draft) {
  const body = draft?.body?.replace(/[\u200b\ufeff]/g, '').trim();
  return Boolean(body && (draft.draftId || body !== draft.automaticSignature));
}

export function removeDraftRecovery(user, draft) {
  if (!user || !draft?.key) return;
  try { localStorage.removeItem(prefix(user) + draft.key); } catch {}
}

export function checkpointDraft(user, draft) {
  if (!user || !draft?.key) return;
  if (!hasDraftBody(draft)) return removeDraftRecovery(user, draft);
  try {
    localStorage.setItem(prefix(user) + draft.key, JSON.stringify({
      id: draft.draftId || null,
      data: draftContent(draft)
    }));
  } catch {}
}

export async function recoverDrafts(user, api) {
  const recover = async () => {
    const pending = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix(user))) pending.push(key);
      }
    } catch { return {saved:0,failed:0}; }
    let saved = 0, failed = 0;
    for (const key of pending) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;
        const record = JSON.parse(value);
        if (!record.data?.body?.trim()) {
          localStorage.removeItem(key);
          continue;
        }
        await api('draft_save', record);
        if (localStorage.getItem(key) === value) localStorage.removeItem(key);
        saved++;
      } catch { failed++; }
    }
    return {saved,failed};
  };
  return navigator.locks
    ? navigator.locks.request(prefix(user), recover)
    : recover();
}
