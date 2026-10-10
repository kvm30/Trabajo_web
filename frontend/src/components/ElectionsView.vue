<script setup>
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  go: { type: Function, required: true },
  refreshKey: { type: Number, required: true },
});

const elections = ref([]);
const error = ref('');
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };

async function load() {
  error.value = '';
  try {
    elections.value = await props.api('/elections');
  } catch (err) {
    error.value = err.message;
  }
}

onMounted(load);
watch(() => props.refreshKey, load);
</script>

<template>
  <h2>Elecciones</h2>
  <div v-if="error" class="card msg bad">{{ error }}</div>
  <div v-for="election in elections" :key="election.id" class="card">
    <div class="row between">
      <h3>{{ election.title }}</h3>
      <span class="badge" :class="election.status">{{ statusLabels[election.status] }}</span>
    </div>
    <p class="muted">{{ election.description }}</p>
    <div class="row between">
      <span class="muted">{{ election.total_votes }} votos</span>
      <button @click="go('detail', { id: election.id })">
        {{ election.status === 'open' ? 'Votar / ver conteo' : 'Ver detalle' }}
      </button>
    </div>
  </div>
  <p v-if="!error && elections.length === 0" class="muted">Aún no hay elecciones.</p>
</template>
