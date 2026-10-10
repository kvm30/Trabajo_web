<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { io } from 'socket.io-client';
import { createApi } from './api.js';
import AdminView from './components/AdminView.vue';
import DetailView from './components/DetailView.vue';
import ElectionsView from './components/ElectionsView.vue';
import LoginView from './components/LoginView.vue';
import VerifyView from './components/VerifyView.vue';

const savedSession = localStorage.getItem('session');
const session = ref(savedSession ? JSON.parse(savedSession) : null);
const view = ref({ name: 'elections' });
const refreshKey = ref(0);
const liveResults = ref(null);
const toastMessage = ref('');
const pageKey = computed(() => `${view.value.name}:${view.value.id ?? ''}:${view.value.register ? 1 : 0}`);
let toastTimer;
let currentRoom = null;
const socket = io();

function go(name, extra = {}) {
  view.value = { name, ...extra };
}

function setSession(value) {
  session.value = value;
  if (value) localStorage.setItem('session', JSON.stringify(value));
  else localStorage.removeItem('session');
}

function logout() {
  setSession(null);
  go('elections');
}

function toast(message) {
  toastMessage.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 2500);
}

function joinRoom(id) {
  if (currentRoom) socket.emit('leave', currentRoom);
  currentRoom = id;
  if (id) socket.emit('join', id);
}

const api = createApi(() => session.value, logout);

function handleResultsUpdate(data) {
  if (view.value.name === 'detail' && Number(view.value.id) === Number(data.electionId)) {
    liveResults.value = data;
  }
}

function handleElectionsChanged() {
  if (['elections', 'admin', 'detail'].includes(view.value.name)) refreshKey.value += 1;
}

function handleConnect() {
  if (currentRoom) socket.emit('join', currentRoom);
}

onMounted(() => {
  socket.on('results:update', handleResultsUpdate);
  socket.on('elections:changed', handleElectionsChanged);
  socket.on('connect', handleConnect);
});

onBeforeUnmount(() => {
  socket.off('results:update', handleResultsUpdate);
  socket.off('elections:changed', handleElectionsChanged);
  socket.off('connect', handleConnect);
  socket.disconnect();
  clearTimeout(toastTimer);
});

watch(view, (current) => {
  liveResults.value = null;
  if (current.name !== 'detail') joinRoom(null);
});
</script>

<template>
  <header>
    <h1>🗳️ Votación en Vivo</h1>
    <nav>
      <button class="ghost" @click="go('elections')">Elecciones</button>
      <button class="ghost" @click="go('verify')">Verificar comprobante</button>
      <button v-if="session?.user.role === 'admin'" class="ghost" @click="go('admin')">Admin</button>
      <span v-if="session" class="muted">{{ session.user.name }}</span>
      <button v-if="session" class="ghost" @click="logout">Salir</button>
      <button v-else @click="go('login')">Ingresar</button>
    </nav>
  </header>

  <main>
    <ElectionsView
      v-if="view.name === 'elections'"
      :key="pageKey"
      :api="api"
      :go="go"
      :refresh-key="refreshKey"
    />
    <DetailView
      v-else-if="view.name === 'detail'"
      :key="pageKey"
      :api="api"
      :view="view"
      :session="session"
      :go="go"
      :toast="toast"
      :join-room="joinRoom"
      :live-results="liveResults"
      :refresh-key="refreshKey"
    />
    <LoginView
      v-else-if="view.name === 'login'"
      :key="pageKey"
      :api="api"
      :view="view"
      :go="go"
      :set-session="setSession"
    />
    <VerifyView
      v-else-if="view.name === 'verify'"
      :key="pageKey"
      :api="api"
      :view="view"
    />
    <AdminView
      v-else-if="view.name === 'admin'"
      :key="pageKey"
      :api="api"
      :session="session"
      :go="go"
      :toast="toast"
      :refresh-key="refreshKey"
    />
  </main>

  <div id="toast" :class="{ show: toastMessage }">{{ toastMessage }}</div>
</template>
