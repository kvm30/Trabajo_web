<script setup>
defineProps({
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  logout: { type: Function, required: true },
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
</template>
