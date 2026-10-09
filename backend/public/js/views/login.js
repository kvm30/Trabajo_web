export function renderLogin({ $, api, go, getView, setSession }) {
  const register = getView().register;
  $('#app').innerHTML = `
  <div class="card" style="max-width:420px;margin:auto">
    <h2>${register ? 'Crear cuenta' : 'Ingresar'}</h2>
    ${register ? '<label>Nombre</label><input id="name">' : ''}
    <label>Email</label><input id="email" type="email">
    <label>Contraseña</label><input id="pw" type="password">
    <div class="row between">
      <button id="go">${register ? 'Registrarme' : 'Entrar'}</button>
      <a href="#" id="sw" class="muted">${register ? 'Ya tengo cuenta' : 'Crear cuenta'}</a>
    </div><div id="err"></div>
  </div>`;
  $('#sw').onclick = (event) => {
    event.preventDefault();
    go('login', { register: !register });
  };
  $('#go').onclick = async () => {
    try {
      const body = {
        email: $('#email').value,
        password: $('#pw').value,
        ...(register && { name: $('#name').value }),
      };
      const data = await api(register ? '/auth/register' : '/auth/login', 'POST', body);
      setSession({ token: data.token, user: data.user });
      go('elections');
    } catch (error) {
      $('#err').innerHTML = `<div class="msg bad">${esc(error.message)}</div>`;
    }
  };
}
