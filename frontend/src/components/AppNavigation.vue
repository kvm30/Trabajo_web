<script setup>
import { ref } from 'vue';

const props = defineProps({
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  logout: { type: Function, required: true },
  notifications: { type: Array, default: () => [] },
  unreadNotifications: { type: Number, default: 0 },
  readNotifications: { type: Function, default: null },
});
const showNotifications = ref(false);

function formatNotificationTime(value) {
  return value ? new Date(value).toLocaleString() : '';
}

function toggleNotifications() {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value && props.unreadNotifications && props.readNotifications) {
    props.readNotifications();
  }
}
</script>

<template>
  <header class="site-header">
    <h1 class="site-brand">🗳️ Votación en Vivo</h1>
    <nav class="nav-actions" aria-label="Navegación principal">
      <button class="ghost" @click="go('elections')">Elecciones</button>
      <button class="ghost" @click="go('calendar')">Calendario</button>
      <button class="ghost" @click="go('verify')">Verificar comprobante</button>
      <button v-if="session" class="ghost" @click="go('history')">Mi historial</button>
      <button v-if="session?.user.role === 'voter'" class="ghost" @click="go('participation')">Participación</button>
      <button v-if="session?.user.role === 'admin'" class="ghost" @click="go('admin')">Admin</button>
      <button v-if="session" class="ghost" @click="go('profile')">Perfil</button>
      <div v-if="session" class="notification-menu">
        <button
          type="button"
          class="ghost notification-bell"
          :aria-label="`Notificaciones, ${unreadNotifications} sin leer`"
          aria-haspopup="true"
          :aria-expanded="showNotifications"
          @click="toggleNotifications"
        >
          🔔 <span v-if="unreadNotifications" class="notification-count">{{ unreadNotifications }}</span>
        </button>
        <div v-if="showNotifications" class="notification-panel" role="dialog" aria-label="Notificaciones">
          <div class="notification-panel-head">
            <strong>Notificaciones</strong>
            <button type="button" class="ghost" @click="showNotifications = false">Cerrar</button>
          </div>
          <p v-if="notifications.length === 0" class="muted notification-empty">No tienes notificaciones.</p>
          <article v-for="item in notifications" :key="item.id" class="notification-item">
            <strong>{{ item.title }}</strong>
            <p>{{ item.message }}</p>
            <small class="muted">{{ formatNotificationTime(item.created_at) }}</small>
          </article>
        </div>
      </div>
      <span v-if="session" class="user-chip">{{ session.user.name }}</span>
      <button v-if="session" class="ghost" @click="logout">Salir</button>
      <button v-else @click="go('login')">Ingresar</button>
    </nav>
  </header>
</template>

<style scoped>
.site-brand {
  color: var(--text);
}

.notification-menu {
  position: relative;
}

.notification-bell {
  position: relative;
}

.notification-count {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  border-radius: 99px;
  background: var(--brand);
  color: white;
  font-size: 0.72rem;
  line-height: 18px;
  text-align: center;
}

.notification-panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  right: 0;
  width: min(360px, calc(100vw - 24px));
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 16px 40px rgb(57 42 71 / 18%);
}

.notification-panel-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.notification-item {
  padding: 12px;
  border-bottom: 1px solid var(--line);
}

.notification-item p {
  margin: 5px 0;
}

.notification-empty {
  padding: 18px 12px;
  text-align: center;
}

.user-chip {
  max-width: 180px;
  overflow: hidden;
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 99px;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
