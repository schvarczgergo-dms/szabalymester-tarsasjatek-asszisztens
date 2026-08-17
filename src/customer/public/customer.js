const questionEl = document.querySelector('#question');
const askBtn = document.querySelector('#ask');
const resultEl = document.querySelector('#result');
const pathEl = document.querySelector('#path');
const messageEl = document.querySelector('#message');
const sourcesEl = document.querySelector('#sources');
const metaEl = document.querySelector('#meta');
const lookupEl = document.querySelector('#lookup');
const checkBtn = document.querySelector('#check');
const feedbackRow = document.querySelector('#feedback-row');
const flagWrongBtn = document.querySelector('#flag-wrong');

function show(data) {
  resultEl.hidden = false;
  const path = data.path === 'auto' ? 'auto' : (data.ticketStatus ?? 'escalate');
  pathEl.className = `status ${path}`;
  pathEl.textContent =
    data.path === 'auto'
      ? 'tudásbázisból'
      : data.ticketStatus === 'approved'
        ? 'játékmester jóváhagyta'
        : data.ticketStatus === 'rejected'
          ? 'játékmester elutasította'
          : 'játékmesterre vár';
  messageEl.textContent = data.customerMessage ?? '';
  sourcesEl.replaceChildren();
  for (const s of data.sources ?? []) {
    const li = document.createElement('li');
    const href = typeof s.source === 'string' ? s.source : '';
    const label = `${s.game} · ${s.section}`;
    if (href.startsWith('https://') || href.startsWith('http://')) {
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = label;
      li.append(a);
    } else {
      li.textContent = label;
    }
    sourcesEl.append(li);
  }
  metaEl.textContent = `Azonosító: ${data.requestId}`;
  feedbackRow.hidden = data.path !== 'auto';
  flagWrongBtn.dataset.requestId = data.requestId ?? '';
  if (data.feedback === 'wrong_auto') {
    flagWrongBtn.disabled = true;
    flagWrongBtn.textContent = 'Jelölve: hibás auto-válasz';
  } else {
    flagWrongBtn.disabled = false;
    flagWrongBtn.textContent = 'Hibás volt a válasz';
  }
}

async function postAsk() {
  const question = questionEl.value.trim();
  if (!question) return;
  askBtn.disabled = true;
  askBtn.textContent = 'Keresés…';
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Hiba');
    show(data);
    lookupEl.value = data.requestId;
  } catch (err) {
    resultEl.hidden = false;
    pathEl.className = 'status rejected';
    pathEl.textContent = 'hiba';
    messageEl.textContent = err instanceof Error ? err.message : String(err);
    sourcesEl.replaceChildren();
    metaEl.textContent = '';
    feedbackRow.hidden = true;
  } finally {
    askBtn.disabled = false;
    askBtn.textContent = 'Kérdezek';
  }
}

async function checkStatus() {
  const id = lookupEl.value.trim();
  if (!id) return;
  checkBtn.disabled = true;
  try {
    const res = await fetch(`/api/requests/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Hiba');
    show(data);
  } catch (err) {
    resultEl.hidden = false;
    pathEl.className = 'status rejected';
    pathEl.textContent = 'hiba';
    messageEl.textContent = err instanceof Error ? err.message : String(err);
    sourcesEl.replaceChildren();
    metaEl.textContent = '';
    feedbackRow.hidden = true;
  } finally {
    checkBtn.disabled = false;
  }
}

async function flagWrong() {
  const id = flagWrongBtn.dataset.requestId;
  if (!id) return;
  flagWrongBtn.disabled = true;
  const res = await fetch(`/api/requests/${encodeURIComponent(id)}/feedback`, { method: 'POST' });
  if (!res.ok) {
    if (res.status === 409) {
      flagWrongBtn.disabled = true;
      flagWrongBtn.textContent = 'Jelölve: hibás auto-válasz';
      metaEl.textContent = `Azonosító: ${id} · ezt a választ már jelölted`;
      return;
    }
    flagWrongBtn.disabled = false;
    metaEl.textContent = `Azonosító: ${id} · a jelölés nem sikerült`;
    return;
  }
  flagWrongBtn.textContent = 'Jelölve: hibás auto-válasz';
}

askBtn.addEventListener('click', () => void postAsk());
checkBtn.addEventListener('click', () => void checkStatus());
flagWrongBtn.addEventListener('click', () => void flagWrong());
document.querySelectorAll('[data-fill]').forEach((btn) => {
  btn.addEventListener('click', () => {
    questionEl.value = btn.getAttribute('data-fill') ?? '';
    questionEl.focus();
  });
});
