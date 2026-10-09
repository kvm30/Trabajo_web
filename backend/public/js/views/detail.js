import { $, esc, fmt } from '../utils.js';

export function paintResults(results) {
  const box = $('#results');
  if (!box) return;
  box.innerHTML = results.candidates.map((candidate) => {
    const percentage = results.total ? Math.round((candidate.votes / results.total) * 100) : 0;
    return `<div style="margin-bottom:12px"><div class="row between"><b>${esc(candidate.name)}</b><span>${candidate.votes} (${percentage}%)</span></div>
      <div class="bar"><div style="width:${percentage}%"></div></div></div>`;
  }).join('') || '<p class="muted">Sin candidatos.</p>';
  $('#total').textContent = results.total;
}

export async function renderDetail({ $, api, esc, fmt, go, getView, getSession, joinRoom, toast }) {
  const view = getView();
  const session = getSession();
  const election = await api('/elections/' + view.id);
  joinRoom(election.id);
  const voted = session ? (await api(`/elections/${election.id}/has-voted`)).voted : false;
  const saved = session && localStorage.getItem(receiptKey(session, election.id));
  let ballot = '';

  if (election.status === 'open') {
    if (!session) ballot = '<p class="muted">Inicia sesión para votar.</p>';
    else if (voted) ballot = '<div class="msg ok">✅ Ya votaste en esta elección.</div>';
    else ballot = `<h3>Tu voto (secreto)</h3>
      ${election.candidates.map((candidate) => `<label class="cand"><input type="radio" name="cand" value="${candidate.id}">${esc(candidate.name)}
        <div class="muted">${esc(candidate.description)}</div></label>`).join('')}
      <button id="vote">Emitir voto</button>`;
  } else {
    ballot = `<div class="msg ${election.status === 'closed' ? 'bad' : ''}">Elección ${STATUS[election.status].toLowerCase()}.</div>`;
  }

  $('#app').innerHTML = `
  <button class="ghost" data-go="elections" id="back">← Volver</button>
  <div class="card" style="margin-top:12px">
    <div class="row between"><h2>${esc(election.title)}</h2><span class="badge ${election.status}">${STATUS[election.status]}</span></div>
    <p class="muted">${esc(election.description)}</p>
  </div>
  <div class="card"><div class="row between"><h3><span class="live"></span>Conteo en vivo</h3>
    <span class="muted">Total: <b id="total">0</b></span></div><div id="results"></div></div>
  <div class="card" id="ballot">${ballot}</div>
  <div id="receipt">${saved ? receiptHtml(JSON.parse(saved), esc, fmt) : ''}</div>
  <div class="card"><h3>Auditoría pública</h3>
    <p class="muted">Cada voto se encadena con el anterior mediante SHA256. Cualquiera puede comprobar que nada fue alterado.</p>
    <button class="ghost" id="integ">Verificar integridad de la cadena</button>
    <button class="ghost" id="chain">Ver cadena de comprobantes</button>
    <div id="audit"></div></div>`;
  $('#back').onclick = () => go('elections');
  paintResults(election);
  bindReceiptActions({ $, esc, fmt, go, toast });

  $('#vote')?.addEventListener('click', async () => {
    const selected = document.querySelector('input[name=cand]:checked');
    if (!selected) return toast('Elige un candidato');
    if (!confirm('Tu voto es definitivo y anónimo. ¿Confirmar?')) return;
    try {
      const receipt = await api(`/elections/${election.id}/vote`, 'POST', { candidate_id: +selected.value });
      localStorage.setItem(receiptKey(session, election.id), JSON.stringify(receipt));
      toast('Voto registrado');
      go('detail', { id: election.id });
    } catch (error) {
      toast(error.message);
    }
  });
  $('#integ').onclick = async () => {
    const result = await api(`/audit/${election.id}/integrity`);
    $('#audit').innerHTML = result.valid
      ? `<div class="msg ok">✅ Cadena íntegra: ${result.checked} votos verificados.<div class="hash">Hash final: ${esc(result.head_hash || '—')}</div></div>`
      : `<div class="msg bad">⚠️ Cadena ROTA en el voto #${result.broken_at_position}. Hubo manipulación.</div>`;
  };
  $('#chain').onclick = async () => {
    const rows = await api(`/audit/${election.id}/chain`);
    $('#audit').innerHTML = `<div class="list">${rows.map((row, index) => `<div>#${index + 1} ${esc(row.receipt_hash)}</div>`).join('') || 'Sin votos'}</div>`;
  };
}

function receiptHtml(receipt, esc, fmt) {
  return `<div class="card" style="border-color:var(--ok)"><h3>🧾 Tu comprobante anónimo</h3>
    <p class="muted">Guárdalo: sirve para verificar que tu voto fue contado. No revela por quién votaste ni quién eres.</p>
    <div class="hash">${esc(receipt.receipt_hash)}</div>
    <p class="muted">Voto #${receipt.position} · ${fmt(receipt.created_at)}</p>
    <button class="ghost" data-copy="${esc(receipt.receipt_hash)}">Copiar</button>
    <button class="ghost" data-verify="${esc(receipt.receipt_hash)}">Verificar ahora</button></div>`;
}

function bindReceiptActions({ $, go, toast }) {
  $('[data-copy]')?.addEventListener('click', async (event) => {
    await navigator.clipboard.writeText(event.currentTarget.dataset.copy);
    toast('Copiado');
  });
  $('[data-verify]')?.addEventListener('click', (event) => {
    go('verify', { hash: event.currentTarget.dataset.verify });
  });
}

function receiptKey(session, electionId) {
  return `receipt:${session.user.id}:${electionId}`;
}

const STATUS = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
