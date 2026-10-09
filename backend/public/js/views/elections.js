export async function renderElections({ $, api, esc, go }) {
  const elections = await api('/elections');
  $('#app').innerHTML = `<h2>Elecciones</h2>` + (elections.map((election) => `
    <div class="card">
      <div class="row between"><h3>${esc(election.title)}</h3><span class="badge ${election.status}">${STATUS[election.status]}</span></div>
      <p class="muted">${esc(election.description)}</p>
      <div class="row between"><span class="muted">${election.total_votes} votos</span>
      <button data-id="${election.id}">${election.status === 'open' ? 'Votar / ver conteo' : 'Ver detalle'}</button></div>
    </div>`).join('') || '<p class="muted">Aún no hay elecciones.</p>');
  document.querySelectorAll('[data-id]').forEach((button) => {
    button.onclick = () => go('detail', { id: +button.dataset.id });
  });
}

const STATUS = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
