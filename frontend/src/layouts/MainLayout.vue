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
  <AppNavigation
    :session="session"
    :go="go"
    :logout="logout"
    :notifications="notifications"
    :unread-notifications="unreadNotifications"
    :read-notifications="readNotifications"
  />
  <main>
    <slot />
  </main>
  <div id="toast" :class="{ show: toastMessage }">{{ toastMessage }}</div>
</template>
