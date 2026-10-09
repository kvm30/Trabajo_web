import { createApi } from './api.js';
import { $, esc, fmt, toast } from './utils.js';
import { paintResults, renderDetail } from './views/detail.js';
import { renderAdmin } from './views/admin.js';
import { renderElections } from './views/elections.js';
import { renderLogin } from './views/login.js';
import { renderVerify } from './views/verify.js';

let session = JSON.parse(localStorage.getItem('session') || 'null');
let view = { name: 'elections' };
let currentRoom = null;
const socket = io();

const go = (name, extra = {}) => {
  view = { name, ...extra };
  render();
};

function setSession(value) {
  session = value;
  if (value) localStorage.setItem('session', JSON.stringify(value));
  else localStorage.removeItem('session');
}

function logout() {
  setSession(null);
  go('elections');
}

const api = createApi(() => session, logout);
const joinRoom = (id) => {
  if (currentRoom) socket.emit('leave', currentRoom);
  currentRoom = id;
  if (id) socket.emit('join', id);
};

const context = {
  $,
  api,
  esc,
  fmt,
  go,
  joinRoom,
  toast,
  getSession: () => session,
  getView: () => view,
  setSession,
};

function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = `
    <button class="ghost" data-go="elections">Elecciones</button>
    <button class="ghost" data-go="verify">Verificar comprobante</button>
    ${session?.user.role === 'admin' ? '<button class="ghost" data-go="admin">Admin</button>' : ''}
    ${session ? `<span class="muted">${esc(session.user.name)}</span><button class="ghost" id="out">Salir</button>`
      : '<button data-go="login">Ingresar</button>'}`;
  nav.querySelectorAll('[data-go]').forEach((button) => {
    button.onclick = () => go(button.dataset.go);
  });
  $('#out')?.addEventListener('click', logout);
}

async function render() {
  renderNav();
  if (view.name !== 'detail') joinRoom(null);
  try {
    const screens = {
      elections: renderElections,
      detail: renderDetail,
      login: renderLogin,
      verify: renderVerify,
      admin: renderAdmin,
    };
    await screens[view.name](context);
  } catch (error) {
    $('#app').innerHTML = `<div class="card msg bad">${esc(error.message)}</div>`;
  }
}

socket.on('results:update', (data) => {
  if (view.name === 'detail' && view.id === data.electionId) paintResults(data);
});
socket.on('elections:changed', () => {
  if (view.name === 'elections' || view.name === 'admin' || view.name === 'detail') render();
});
socket.on('connect', () => currentRoom && socket.emit('join', currentRoom));

render();
