const listEl = document.querySelector('#list');
const detailEl = document.querySelector('#detail');
const metricsEl = document.querySelector('#metrics');
const reloadBtn = document.querySelector('#reload');

let selectedId = null;
let tickets = [];

const reasonLabel = {
  empty_retrieval: 'üres keresés — a tudásbázis nem adott találatot',
  retrieval_error: 'keresési hiba',
  no_search: 'az agent nem keresett',
  agent_error: 'az agent nem tudott válaszolni (modell / kulcs)',
  game_mismatch: 'a találat más játékról szól, mint a kérdés',
};

function renderList() {
  if (tickets.length === 0) {
    listEl.textContent = 'Nincs pending jegy.';
    return;
  }
  listEl.replaceChildren();
  for (const t of tickets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ticket${t.id === selectedId ? ' active' : ''}`;
    const strong = document.createElement('strong');
    strong.textContent = t.question.slice(0, 90);
    const small = document.createElement('small');
    small.textContent = `${reasonLabel[t.reason] ?? t.reason} · ${t.id.slice(0, 8)}`;
    btn.append(strong, small);
    btn.addEventListener('click', () => {
      selectedId = t.id;
      renderList();
      renderDetail(t);
    });
    listEl.append(btn);
  }
}

function renderDetail(ticket) {
  detailEl.innerHTML = `
    <span class="status pending">pending</span>
    <p class="meta">Jegy: ${ticket.id}<br />Kérés: ${ticket.requestId}</p>
    <label>Vendég kérdése</label>
    <p class="answer">${escapeHtml(ticket.question)}</p>
    <label>Miért jött ide</label>
    <p>${escapeHtml(reasonLabel[ticket.reason] ?? ticket.reason)}</p>
    <label>Agent vázlata (a vendég ezt NEM látta)</label>
    <div class="draft">${escapeHtml(ticket.draftAnswer ?? '—')}</div>
    <label for="operator">Játékmester neve</label>
    <input id="operator" value="Anna" />
    <label for="answer" style="margin-top:12px">Válasz a vendégnek</label>
    <textarea id="answer" placeholder="Ezt látja a vendég a jóváhagyás után."></textarea>
    <label for="tag" style="margin-top:12px">Mérés: mi volt ez az eset</label>
    <select id="tag">
      <option value="answered">answered — helyes eszkaláció, mi válaszoltunk</option>
      <option value="should_have_auto">should_have_auto — a tudásbázisban benne volt (agent hiba)</option>
      <option value="out_of_scope">out_of_scope — nem szabálykérdés / nincs a korpuszban</option>
    </select>
    <div class="row">
      <button type="button" id="approve">Jóváhagyom és elküldöm</button>
      <button type="button" class="secondary" id="reject">Elutasítom</button>
    </div>
  `;
  detailEl.querySelector('#approve').addEventListener('click', () => void resolve('approve'));
  detailEl.querySelector('#reject').addEventListener('click', () => void resolve('reject'));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function resolve(action) {
  if (!selectedId) return;
  const operator = detailEl.querySelector('#operator').value.trim();
  const answer = detailEl.querySelector('#answer').value.trim();
  const tag = detailEl.querySelector('#tag').value;
  const res = await fetch(`/api/tickets/${encodeURIComponent(selectedId)}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, operator, answer, tag }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error ?? 'Nem sikerült lezárni.');
    return;
  }
  selectedId = null;
  await load();
  detailEl.innerHTML = `<p class="lede">Jegy lezárva (${data.ticket.status}). A vendég az azonosítóval megnézheti.</p>`;
}

async function load() {
  const [inbox, metrics] = await Promise.all([
    fetch('/api/tickets?status=pending').then((r) => r.json()),
    fetch('/api/metrics').then((r) => r.json()),
  ]);
  tickets = inbox.tickets ?? [];
  metricsEl.textContent = `Kérések: ${metrics.requests} · auto: ${metrics.auto} · eszkaláció: ${metrics.escalate} · pending: ${metrics.pendingTickets} · téves absztenció: ${metrics.shouldHaveAuto} · hibás auto: ${metrics.wrongAuto}`;
  renderList();
}

reloadBtn.addEventListener('click', () => void load());
void load();
