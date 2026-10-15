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
  <AppNavigation :session="session" :go="go" :logout="logout" />
  <main>
    <slot />
  </main>
  <div id="toast" :class="{ show: toastMessage }">{{ toastMessage }}</div>
</template>
