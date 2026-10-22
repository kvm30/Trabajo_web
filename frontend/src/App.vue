<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io } from 'socket.io-client';
import { createApi } from './services/api.js';
import MainLayout from './layouts/MainLayout.vue';

const route = useRoute();
const router = useRouter();
const savedSession = localStorage.getItem('session');
const session = ref(savedSession ? JSON.parse(savedSession) : null);
const refreshKey = ref(0);
const liveResults = ref(null);
const toastMessage = ref('');
const view = computed(() => ({
  name: route.name,
  id: route.params.id,
  register: route.name === 'register',
  recovery: route.name === 'forgot-password',
  resetToken: route.query.token,
  hash: route.query.hash,
}));
const pageKey = computed(() => `${route.name}:${route.params.id ?? ''}:${route.query.token ?? ''}:${route.query.hash ?? ''}`);
let toastTimer;
let currentRoom = null;
const socket = io();
const api = createApi(() => session.value, logout);

const pageProps = computed(() => {
  if (route.name === 'detail') {
    return {
      api,
      view: view.value,
      session: session.value,
      go,
      toast,
      joinRoom,
      liveResults: liveResults.value,
      refreshKey: refreshKey.value,
    };
  }
  if (['login', 'register', 'forgot-password', 'reset-password'].includes(route.name)) {
    return { api, view: view.value, go, setSession };
  }
  if (route.name === 'verify') return { api, view: view.value };
  if (route.name === 'admin') {
    return { api, session: session.value, go, toast, refreshKey: refreshKey.value };
  }
  return { api, go, refreshKey: refreshKey.value };
});

function go(name, extra = {}) {
  if (name === 'detail') {
    router.push({ name, params: { id: extra.id } });
  } else if (name === 'login') {
    router.push({ name: extra.register ? 'register' : 'login' });
  } else if (name === 'verify') {
    router.push({ name, query: extra.hash ? { hash: extra.hash } : {} });
  } else if (name === 'reset-password') {
    router.push({ name, query: { token: extra.token } });
  } else {
    router.push({ name });
  }
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

function handleResultsUpdate(data) {
  if (route.name === 'detail' && Number(route.params.id) === Number(data.electionId)) {
    liveResults.value = data;
  }
}

function handleElectionsChanged() {
  if (['elections', 'admin', 'detail'].includes(route.name)) refreshKey.value += 1;
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

watch(() => route.fullPath, () => {
  liveResults.value = null;
  if (route.name !== 'detail') joinRoom(null);
});
</script>

<template>
  <MainLayout :session="session" :go="go" :logout="logout" :toast-message="toastMessage">
    <RouterView v-slot="{ Component }">
      <component
        :is="Component"
        :key="pageKey"
        v-bind="pageProps"
      />
    </RouterView>
  </MainLayout>
</template>
