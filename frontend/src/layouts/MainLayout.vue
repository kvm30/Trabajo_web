<script setup>
import AppNavigation from '../components/AppNavigation.vue';

defineProps({
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  logout: { type: Function, required: true },
  toastMessage: { type: String, default: '' },
});
</script>

<template>
  <a class="skip-link" href="#main-content">Saltar al contenido</a>
  <AppNavigation :session="session" :go="go" :logout="logout" />
  <main id="main-content">
    <slot />
  </main>
  <div id="toast" role="status" aria-live="polite" aria-atomic="true" :class="{ show: toastMessage }">{{ toastMessage }}</div>
</template>
