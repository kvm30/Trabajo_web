<script setup>
import AppNavigation from '../components/AppNavigation.vue';

defineProps({
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  logout: { type: Function, required: true },
  toastMessage: { type: String, default: '' },
  notifications: { type: Array, default: () => [] },
  unreadNotifications: { type: Number, default: 0 },
  readNotifications: { type: Function, default: null },
});
</script>

<template>
  <a class="skip-link" href="#main-content">Saltar al contenido</a>
  <AppNavigation
    :session="session"
    :go="go"
    :logout="logout"
    :notifications="notifications"
    :unread-notifications="unreadNotifications"
    :read-notifications="readNotifications"
  />
  <main id="main-content">
    <slot />
  </main>
  <div id="toast" role="status" aria-live="polite" aria-atomic="true" :class="{ show: toastMessage }">{{ toastMessage }}</div>
</template>
