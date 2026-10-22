<script setup>
defineProps({
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  logout: { type: Function, required: true },
});
</script>

<template>
  <header class="site-header">
    <h1 class="site-brand">🗳️ Votación en Vivo</h1>
    <nav class="nav-actions" aria-label="Navegación principal">
      <button class="ghost" @click="go('elections')">Elecciones</button>
      <button class="ghost" @click="go('verify')">Verificar comprobante</button>
      <button v-if="session" class="ghost" @click="go('history')">Mi historial</button>
      <button v-if="session?.user.role === 'voter'" class="ghost" @click="go('participation')">Participación</button>
      <button v-if="session?.user.role === 'admin'" class="ghost" @click="go('admin')">Admin</button>
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
