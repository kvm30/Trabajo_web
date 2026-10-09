const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => new Date(d).toLocaleString();
const STATUS = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };

let session = JSON.parse(localStorage.getItem('session') || 'null');
let view = { name: 'elections' };
let socket = io();
let currentRoom = null;

// ---------- utilidades ----------
async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(session && { Authorization: 'Bearer ' + session.token }) },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (res.status === 401 && session) { logout(); }
  if (!json.success) throw new Error(json.message || 'Error');
  return json.data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.className = 'show'; setTimeout(() => (t.className = ''), 2500); }
const go = (name, extra = {}) => { view = { name, ...extra }; render(); };
function logout() { session = null; localStorage.removeItem('session'); go('elections'); }
const receiptKey = (eid) => `receipt:${session?.user.id}:${eid}`;

function joinRoom(id) {
  if (currentRoom) socket.emit('leave', currentRoom);
  currentRoom = id;
  if (id) socket.emit('join', id);
}

// ---------- socket: conteo en vivo ----------
socket.on('results:update', (d) => {
  if (view.name === 'detail' && view.id === d.electionId) paintResults(d);
});
socket.on('elections:changed', () => {
  if (view.name === 'elections' || view.name === 'admin' || view.name === 'detail') render();
});
socket.on('connect', () => currentRoom && socket.emit('join', currentRoom));

// ---------- render ----------
function renderNav() {
  const n = $('#nav');
  n.innerHTML = `
    <button class="ghost" data-go="elections">Elecciones</button>
    <button class="ghost" data-go="verify">Verificar comprobante</button>
    ${session?.user.role === 'admin' ? '<button class="ghost" data-go="admin">Admin</button>' : ''}
    ${session ? `<span class="muted">${esc(session.user.name)}</span><button class="ghost" id="out">Salir</button>`
              : '<button data-go="login">Ingresar</button>'}`;
  n.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
  $('#out')?.addEventListener('click', logout);
}

async function render() {
  renderNav();
  if (view.name !== 'detail') joinRoom(null);
  try {
    await ({ elections: vElections, detail: vDetail, login: vLogin, verify: vVerify, admin: vAdmin }[view.name])();
  } catch (e) { $('#app').innerHTML = `<div class="card msg bad">${esc(e.message)}</div>`; }
}

// ---------- login / registro ----------
function vLogin() {
  const reg = view.register;
  $('#app').innerHTML = `
  <div class="card" style="max-width:420px;margin:auto">
    <h2>${reg ? 'Crear cuenta' : 'Ingresar'}</h2>
    ${reg ? '<label>Nombre</label><input id="name">' : ''}
    <label>Email</label><input id="email" type="email">
    <label>Contraseña</label><input id="pw" type="password">
    <div class="row between">
      <button id="go">${reg ? 'Registrarme' : 'Entrar'}</button>
      <a href="#" id="sw" class="muted">${reg ? 'Ya tengo cuenta' : 'Crear cuenta'}</a>
    </div><div id="err"></div>
  </div>`;
  $('#sw').onclick = (e) => { e.preventDefault(); go('login', { register: !reg }); };
  $('#go').onclick = async () => {
    try {
      const body = { email: $('#email').value, password: $('#pw').value, ...(reg && { name: $('#name').value }) };
      const d = await api(reg ? '/auth/register' : '/auth/login', 'POST', body);
      session = { token: d.token, user: d.user };
      localStorage.setItem('session', JSON.stringify(session));
      go('elections');
    } catch (e) { $('#err').innerHTML = `<div class="msg bad">${esc(e.message)}</div>`; }
  };
}

// ---------- lista de elecciones ----------
async function vElections() {
  const list = await api('/elections');
  $('#app').innerHTML = `<h2>Elecciones</h2>` + (list.map((e) => `
    <div class="card">
      <div class="row between"><h3>${esc(e.title)}</h3><span class="badge ${e.status}">${STATUS[e.status]}</span></div>
      <p class="muted">${esc(e.description)}</p>
      <div class="row between"><span class="muted">${e.total_votes} votos</span>
      <button data-id="${e.id}">${e.status === 'open' ? 'Votar / ver conteo' : 'Ver detalle'}</button></div>
    </div>`).join('') || '<p class="muted">Aún no hay elecciones.</p>');
  document.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => go('detail', { id: +b.dataset.id })));
}

// ---------- detalle: votar + conteo en vivo ----------
function paintResults(d) {
  const box = $('#results'); if (!box) return;
  box.innerHTML = d.candidates.map((c) => {
    const pct = d.total ? Math.round((c.votes / d.total) * 100) : 0;
    return `<div style="margin-bottom:12px"><div class="row between"><b>${esc(c.name)}</b><span>${c.votes} (${pct}%)</span></div>
      <div class="bar"><div style="width:${pct}%"></div></div></div>`;
  }).join('') || '<p class="muted">Sin candidatos.</p>';
  $('#total').textContent = d.total;
}

async function vDetail() {
  const e = await api('/elections/' + view.id);
  joinRoom(e.id);
  const voted = session ? (await api(`/elections/${e.id}/has-voted`)).voted : false;
  const saved = session && localStorage.getItem(receiptKey(e.id));
  let ballot = '';
  if (e.status === 'open') {
    if (!session) ballot = '<p class="muted">Inicia sesión para votar.</p>';
    else if (voted) ballot = '<div class="msg ok">✅ Ya votaste en esta elección.</div>';
    else ballot = `<h3>Tu voto (secreto)</h3>
      ${e.candidates.map((c) => `<label class="cand"><input type="radio" name="cand" value="${c.id}">${esc(c.name)}
        <div class="muted">${esc(c.description)}</div></label>`).join('')}
      <button id="vote">Emitir voto</button>`;
  } else ballot = `<div class="msg ${e.status === 'closed' ? 'bad' : ''}">Elección ${STATUS[e.status].toLowerCase()}.</div>`;

  $('#app').innerHTML = `
  <button class="ghost" data-go="elections" id="back">← Volver</button>
  <div class="card" style="margin-top:12px">
    <div class="row between"><h2>${esc(e.title)}</h2><span class="badge ${e.status}">${STATUS[e.status]}</span></div>
    <p class="muted">${esc(e.description)}</p>
  </div>
  <div class="card"><div class="row between"><h3><span class="live"></span>Conteo en vivo</h3>
    <span class="muted">Total: <b id="total">0</b></span></div><div id="results"></div></div>
  <div class="card" id="ballot">${ballot}</div>
  <div id="receipt">${saved ? receiptHtml(JSON.parse(saved)) : ''}</div>
  <div class="card"><h3>Auditoría pública</h3>
    <p class="muted">Cada voto se encadena con el anterior mediante SHA256. Cualquiera puede comprobar que nada fue alterado.</p>
    <button class="ghost" id="integ">Verificar integridad de la cadena</button>
    <button class="ghost" id="chain">Ver cadena de comprobantes</button>
    <div id="audit"></div></div>`;
  $('#back').onclick = () => go('elections');
  paintResults(e);

  $('#vote')?.addEventListener('click', async () => {
    const sel = document.querySelector('input[name=cand]:checked');
    if (!sel) return toast('Elige un candidato');
    if (!confirm('Tu voto es definitivo y anónimo. ¿Confirmar?')) return;
    try {
      const r = await api(`/elections/${e.id}/vote`, 'POST', { candidate_id: +sel.value });
      localStorage.setItem(receiptKey(e.id), JSON.stringify(r));
      toast('Voto registrado'); render();
    } catch (err) { toast(err.message); }
  });
  $('#integ').onclick = async () => {
    const r = await api(`/audit/${e.id}/integrity`);
    $('#audit').innerHTML = r.valid
      ? `<div class="msg ok">✅ Cadena íntegra: ${r.checked} votos verificados.<div class="hash">Hash final: ${r.head_hash || '—'}</div></div>`
      : `<div class="msg bad">⚠️ Cadena ROTA en el voto #${r.broken_at_position}. Hubo manipulación.</div>`;
  };
  $('#chain').onclick = async () => {
    const rows = await api(`/audit/${e.id}/chain`);
    $('#audit').innerHTML = `<div class="list">${rows.map((r, i) => `<div>#${i + 1} ${r.receipt_hash}</div>`).join('') || 'Sin votos'}</div>`;
  };
}

function receiptHtml(r) {
  return `<div class="card" style="border-color:var(--ok)"><h3>🧾 Tu comprobante anónimo</h3>
    <p class="muted">Guárdalo: sirve para verificar que tu voto fue contado. No revela por quién votaste ni quién eres.</p>
    <div class="hash">${r.receipt_hash}</div>
    <p class="muted">Voto #${r.position} · ${fmt(r.created_at)}</p>
    <button class="ghost" onclick="navigator.clipboard.writeText('${r.receipt_hash}');toast('Copiado')">Copiar</button>
    <button class="ghost" onclick="go('verify',{hash:'${r.receipt_hash}'})">Verificar ahora</button></div>`;
}

// ---------- verificación ciudadana ----------
function vVerify() {
  $('#app').innerHTML = `<div class="card"><h2>Verificación ciudadana</h2>
    <p class="muted">Pega tu comprobante SHA256 para confirmar que tu voto está en la cadena. No requiere iniciar sesión.</p>
    <input id="h" placeholder="64 caracteres hexadecimales" value="${esc(view.hash || '')}">
    <button id="chk">Verificar</button><div id="out2"></div></div>`;
  const check = async () => {
    try {
      const r = await api('/audit/verify/' + $('#h').value.trim());
      $('#out2').innerHTML = r.counted
        ? `<div class="msg ok">✅ Voto CONTADO en «${esc(r.election_title)}»<br>Posición #${r.position} · ${fmt(r.created_at)}
           <div class="hash">${r.chain_hash}</div></div>`
        : '<div class="msg bad">❌ Comprobante no encontrado.</div>';
    } catch (e) { $('#out2').innerHTML = `<div class="msg bad">${esc(e.message)}</div>`; }
  };
  $('#chk').onclick = check;
  if (view.hash) check();
}

// ---------- admin ----------
async function vAdmin() {
  if (session?.user.role !== 'admin') return go('elections');
  const list = await api('/elections');
  $('#app').innerHTML = `
  <div class="card"><h2>Nueva elección</h2>
    <label>Título</label><input id="t"><label>Descripción</label><textarea id="d" rows="2"></textarea>
    <button id="mk">Crear</button></div>
  ${list.map((e) => `<div class="card"><div class="row between"><h3>${esc(e.title)}</h3><span class="badge ${e.status}">${STATUS[e.status]}</span></div>
    ${e.status === 'draft' ? `<div class="row"><input data-cn="${e.id}" placeholder="Nombre del candidato" style="flex:1;margin:0">
      <button data-add="${e.id}">+ Candidato</button></div>` : ''}
    <div class="row" style="margin-top:10px">
      ${['draft', 'open', 'closed'].filter((s) => s !== e.status).map((s) =>
        `<button class="${s === 'open' ? 'ok' : s === 'closed' ? 'danger' : 'ghost'}" data-st="${e.id}:${s}">→ ${STATUS[s]}</button>`).join('')}
    </div></div>`).join('')}`;
  $('#mk').onclick = async () => {
    try { await api('/elections', 'POST', { title: $('#t').value, description: $('#d').value }); toast('Creada'); render(); }
    catch (e) { toast(e.message); }
  };
  document.querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => {
    const inp = document.querySelector(`[data-cn="${b.dataset.add}"]`);
    try { await api(`/elections/${b.dataset.add}/candidates`, 'POST', { name: inp.value }); toast('Candidato agregado'); inp.value = ''; }
    catch (e) { toast(e.message); }
  }));
  document.querySelectorAll('[data-st]').forEach((b) => (b.onclick = async () => {
    const [id, status] = b.dataset.st.split(':');
    try { await api(`/elections/${id}/status`, 'PATCH', { status }); render(); } catch (e) { toast(e.message); }
  }));
}

render();
