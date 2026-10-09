export function renderVerify({ $, api, esc, fmt, getView }) {
  const view = getView();
  $('#app').innerHTML = `<div class="card"><h2>Verificación ciudadana</h2>
    <p class="muted">Pega tu comprobante SHA256 para confirmar que tu voto está en la cadena. No requiere iniciar sesión.</p>
    <input id="h" placeholder="64 caracteres hexadecimales" value="${esc(view.hash || '')}">
    <button id="chk">Verificar</button><div id="out2"></div></div>`;
  const check = async () => {
    try {
      const result = await api('/audit/verify/' + $('#h').value.trim());
      $('#out2').innerHTML = result.counted
        ? `<div class="msg ok">✅ Voto CONTADO en «${esc(result.election_title)}»<br>Posición #${result.position} · ${fmt(result.created_at)}
           <div class="hash">${esc(result.chain_hash)}</div></div>`
        : '<div class="msg bad">❌ Comprobante no encontrado.</div>';
    } catch (error) {
      $('#out2').innerHTML = `<div class="msg bad">${esc(error.message)}</div>`;
    }
  };
  $('#chk').onclick = check;
  if (view.hash) check();
}
