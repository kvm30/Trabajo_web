<script setup>
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  go: { type: Function, required: true },
  refreshKey: { type: Number, required: true },
});

const elections = ref([]);
const error = ref('');
const search = ref('');
const statusFilter = ref('all');
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
const filteredElections = computed(() => elections.value.filter((election) => {
  const matchesSearch = `${election.title} ${election.description || ''}`
    .toLocaleLowerCase()
    .includes(search.value.trim().toLocaleLowerCase());
  return matchesSearch && (statusFilter.value === 'all' || election.status === statusFilter.value);
}));

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
  <div class="card election-filters">
    <label for="election-search">Buscar elecciones</label>
    <input
      id="election-search"
      v-model="search"
      type="search"
      placeholder="Título o descripción"
      autocomplete="off"
    >
    <label for="election-status">Filtrar por estado</label>
    <select id="election-status" v-model="statusFilter">
      <option value="all">Todos los estados</option>
      <option value="draft">Borrador</option>
      <option value="open">Abierta</option>
      <option value="closed">Cerrada</option>
    </select>
  </div>
  <div v-for="election in filteredElections" :key="election.id" class="card">
    <div class="row between">
      <h3>{{ election.title }}</h3>
      <span class="badge" :class="election.status">{{ statusLabels[election.status] }}</span>
    </div>
    <p class="muted">{{ election.description }}</p>
    <p v-if="election.starts_at" class="muted">
      Inicio: {{ new Date(election.starts_at).toLocaleString() }}
      <span v-if="election.ends_at"> · Cierre: {{ new Date(election.ends_at).toLocaleString() }}</span>
    </p>
    <div class="row between">
      <span class="muted">{{ election.total_votes }} votos</span>
      <button @click="go('detail', { id: election.id })">
        {{ election.status === 'open' ? 'Votar / ver conteo' : 'Ver detalle' }}
      </button>
    </div>
  </div>
  <p v-if="!error && elections.length === 0" class="muted">Aún no hay elecciones.</p>
  <p v-else-if="!error && filteredElections.length === 0" class="muted">No hay elecciones que coincidan con la búsqueda.</p>
</template>
