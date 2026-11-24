const API = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (base, attempt, jitter) =>
  base * 2 ** attempt + (jitter ? Math.floor(Math.random() * 100) : 0);

let chaosMode = false;
let consecutiveFailures = 0;
const FAIL_THRESHOLD = 3;
let disabledUntil = 0;

const $ = (id) => document.getElementById(id);

function linksWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'посилання';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'посилання';
  return 'посилань';
}

function setRequestPill(id) {
  if (id) $('request-pill').textContent = `X-Request-Id: ${id}`;
}

function setStatus(text, kind = '') {
  const el = $('status');
  el.textContent = text;
  el.className = `status ${kind}`.trim();
}

function showDegraded(on) {
  $('degraded-banner').classList.toggle('hidden', !on);
}

function applyDisabledState() {
  const locked = Date.now() < disabledUntil;
  for (const id of ['create-btn', 'refresh-btn', 'load-items']) {
    $(id).disabled = locked;
  }
  if (locked) setTimeout(applyDisabledState, disabledUntil - Date.now() + 20);
}

function noteSuccess() {
  consecutiveFailures = 0;
  showDegraded(false);
}

function noteFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAIL_THRESHOLD) {
    showDegraded(true);
    disabledUntil = Date.now() + 6000;
    applyDisabledState();
  }
}

async function fetchWithResilience(url, opts = {}) {
  const { retry = {}, idempotencyKey, requestId, headers: h, ...init } = opts;
  const { retries = 2, baseDelayMs = 250, timeoutMs = 3000, jitter = true, attempt = 0 } = retry;

  const headers = new Headers(h || {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  headers.set('X-Request-Id', requestId || crypto.randomUUID());
  if (chaosMode) headers.set('X-Chaos', '1');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });

    if (res.status === 429 && retries >= 1) {
      const retryAfter = Number(res.headers.get('Retry-After') || 1) * 1000;
      await sleep(retryAfter);
      return fetchWithResilience(url, {
        ...opts,
        retry: { ...retry, retries: retries - 1, attempt: attempt + 1 },
      });
    }

    if ([502, 503, 504].includes(res.status) && retries >= 1) {
      await sleep(backoff(baseDelayMs, attempt, jitter));
      return fetchWithResilience(url, {
        ...opts,
        retry: { ...retry, retries: retries - 1, attempt: attempt + 1 },
      });
    }

    return res;
  } catch (err) {
    if (retries >= 1) {
      await sleep(backoff(baseDelayMs, attempt, jitter));
      return fetchWithResilience(url, {
        ...opts,
        retry: { ...retry, retries: retries - 1, attempt: attempt + 1 },
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function payloadHash(obj) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getOrReuseKey(payload) {
  const hash = await payloadHash(payload);
  const storeKey = `idem:${hash}`;
  const existing = localStorage.getItem(storeKey);
  if (existing) return { key: existing, storeKey };
  const fresh = crypto.randomUUID();
  localStorage.setItem(storeKey, fresh);
  return { key: fresh, storeKey };
}

function readRequestId(res) {
  const rid = res.headers.get('X-Request-Id');
  if (rid) setRequestPill(rid);
  return rid;
}

async function parseError(res) {
  try {
    const data = await res.json();
    const rid = data.requestId || res.headers.get('X-Request-Id');
    return `${res.status} ${data.error || 'Error'}${data.code ? ` (${data.code})` : ''}${
      rid ? ` · req ${rid}` : ''
    }`;
  } catch {
    return `${res.status} ${res.statusText || 'Error'}`;
  }
}

async function checkHealth() {
  const pill = $('health-pill');
  try {
    const res = await fetchWithResilience(`${API}/health`, {
      retry: { retries: 1, timeoutMs: 2000 },
    });
    readRequestId(res);
    const data = await res.json();
    pill.textContent = `стан: ${data.status}`;
    pill.style.color = data.status === 'ok' ? 'var(--ok)' : 'var(--danger)';
  } catch {
    pill.textContent = 'стан: недоступний';
    pill.style.color = 'var(--danger)';
  }
}

async function loadItems() {
  try {
    const res = await fetchWithResilience(`${API}/items`, {
      retry: { retries: 2, timeoutMs: 2000, baseDelayMs: 250 },
    });
    readRequestId(res);
    if (!res.ok) throw new Error(await parseError(res));
    const items = await res.json();
    const list = $('items-list');
    list.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item.name;
      list.appendChild(li);
    }
    noteSuccess();
    setStatus(`Завантажено елементів: ${items.length} (з бази даних).`, 'ok');
  } catch (err) {
    noteFailure();
    setStatus(`Не вдалося завантажити елементи: ${err.message}`, 'error');
  }
}

async function loadLinks() {
  try {
    const res = await fetchWithResilience(`${API}/links`, {
      retry: { retries: 2, timeoutMs: 2000, baseDelayMs: 250 },
    });
    readRequestId(res);
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    renderLinks(data.items || []);
    noteSuccess();
  } catch (err) {
    noteFailure();
    setStatus(`Не вдалося завантажити посилання: ${err.message}`, 'error');
  }
}

function renderLinks(items) {
  const list = $('links-list');
  $('links-count').textContent = `${items.length} ${linksWord(items.length)}`;
  list.innerHTML = '';
  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Посилань ще немає.';
    list.appendChild(li);
    return;
  }
  for (const link of items) {
    const li = document.createElement('li');
    li.className = 'link-row';

    const main = document.createElement('div');
    main.className = 'link-main';

    const short = document.createElement('a');
    short.href = link.shortUrl || `/${link.slug}`;
    short.target = '_blank';
    short.rel = 'noopener';
    short.textContent = link.shortUrl || `/${link.slug}`;

    const orig = document.createElement('span');
    orig.className = 'orig';
    orig.textContent = `${link.title ? `${link.title} · ` : ''}${link.originalUrl}`;

    const clicks = document.createElement('span');
    clicks.className = 'badge';
    clicks.textContent = `${link.clicks} кліків`;

    main.append(short, orig);

    const right = document.createElement('div');
    right.className = 'actions';
    right.append(clicks);

    const del = document.createElement('button');
    del.className = 'btn danger';
    del.textContent = 'Видалити';
    del.addEventListener('click', () => deleteLink(link.id, del));
    right.append(del);

    li.append(main, right);
    list.appendChild(li);
  }
}

async function deleteLink(id, button) {
  button.disabled = true;
  try {
    const res = await fetchWithResilience(`${API}/links/${id}`, {
      method: 'DELETE',
      retry: { retries: 2, timeoutMs: 2000 },
    });
    readRequestId(res);
    if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
    noteSuccess();
    setStatus('Посилання видалено.', 'ok');
    await loadLinks();
  } catch (err) {
    noteFailure();
    setStatus(`Не вдалося видалити: ${err.message}`, 'error');
    button.disabled = false;
  }
}

async function createLink(event) {
  event.preventDefault();
  const originalUrl = $('original-url').value.trim();
  const slug = $('slug').value.trim();
  const title = $('title').value.trim();

  const payload = { originalUrl };
  if (slug) payload.slug = slug;
  if (title) payload.title = title;

  const { key, storeKey } = await getOrReuseKey(payload);

  $('create-btn').disabled = true;
  setStatus('Надсилання…');
  try {
    const res = await fetchWithResilience(`${API}/links`, {
      method: 'POST',
      body: JSON.stringify(payload),
      idempotencyKey: key,
      retry: { retries: 2, baseDelayMs: 300, timeoutMs: 1500, jitter: true },
    });
    readRequestId(res);
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    localStorage.removeItem(storeKey);
    noteSuccess();
    setStatus(`Створено ${data.shortUrl} (id ${data.id}).`, 'ok');
    $('create-form').reset();
    await loadLinks();
  } catch (err) {
    noteFailure();
    setStatus(`Не вдалося створити: ${err.message}`, 'error');
  } finally {
    $('create-btn').disabled = false;
    applyDisabledState();
  }
}

function wire() {
  $('load-items').addEventListener('click', loadItems);
  $('refresh-btn').addEventListener('click', loadLinks);
  $('create-form').addEventListener('submit', createLink);
  $('chaos-toggle').addEventListener('change', (e) => {
    chaosMode = e.target.checked;
    setStatus(
      chaosMode ? 'Режим chaos УВІМКНЕНО — інжектитимуться збої.' : 'Режим chaos вимкнено.'
    );
  });

  checkHealth();
  loadLinks();
}

wire();
