export async function renderAdmin({ $, api, esc, go, getSession, toast }) {
  if (getSession()?.user.role !== 'admin') return go('elections');
  const elections = await api('/elections');
  $('#app').innerHTML = `
  <div class="card"><h2>Nueva elección</h2>
    <label>Título</label><input id="t"><label>Descripción</label><textarea id="d" rows="2"></textarea>
    <button id="mk">Crear</button></div>
  ${elections.map((election) => `<div class="card"><div class="row between"><h3>${esc(election.title)}</h3><span class="badge ${election.status}">${STATUS[election.status]}</span></div>
    ${election.status === 'draft' ? `<div class="row"><input data-cn="${election.id}" placeholder="Nombre del candidato" style="flex:1;margin:0">
      <button data-add="${election.id}">+ Candidato</button></div>` : ''}
    <div class="row" style="margin-top:10px">
      ${['draft', 'open', 'closed'].filter((status) => status !== election.status).map((status) =>
        `<button class="${status === 'open' ? 'ok' : status === 'closed' ? 'danger' : 'ghost'}" data-st="${election.id}:${status}">→ ${STATUS[status]}</button>`).join('')}
    </div></div>`).join('')}`;
  $('#mk').onclick = async () => {
    try {
      await api('/elections', 'POST', { title: $('#t').value, description: $('#d').value });
      toast('Creada');
      go('admin');
    } catch (error) {
      toast(error.message);
    }
  };
  document.querySelectorAll('[data-add]').forEach((button) => {
    button.onclick = async () => {
      const input = document.querySelector(`[data-cn="${button.dataset.add}"]`);
      try {
        await api(`/elections/${button.dataset.add}/candidates`, 'POST', { name: input.value });
        toast('Candidato agregado');
        input.value = '';
      } catch (error) {
        toast(error.message);
      }
    };
  });
  document.querySelectorAll('[data-st]').forEach((button) => {
    button.onclick = async () => {
      const [id, status] = button.dataset.st.split(':');
      try {
        await api(`/elections/${id}/status`, 'PATCH', { status });
        go('admin');
      } catch (error) {
        toast(error.message);
      }
    };
  });
}

const STATUS = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
