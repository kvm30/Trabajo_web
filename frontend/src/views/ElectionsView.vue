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
const statusFilters = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'closed', label: 'Cerradas' },
];
const filteredElections = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return elections.value.filter((election) => {
    const matchesStatus = statusFilter.value === 'all' || election.status === statusFilter.value;
    const searchableText = `${election.title ?? ''} ${election.description ?? ''}`.toLocaleLowerCase();
    return matchesStatus && searchableText.includes(query);
  });
});

function formatSchedule(value) {
  return value ? new Date(value).toLocaleString() : 'No definida';
}

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

  <section v-if="elections.length" class="card election-filters" aria-label="Buscar y filtrar elecciones">
    <label for="election-search">Buscar por nombre o descripción</label>
    <input
      id="election-search"
      v-model="search"
      type="search"
      placeholder="Ej. elección de representantes"
      autocomplete="off"
    >
    <div class="status-filters" role="group" aria-label="Filtrar por estado">
      <button
        v-for="filter in statusFilters"
        :key="filter.value"
        type="button"
        class="ghost"
        :aria-pressed="statusFilter === filter.value"
        :class="{ selected: statusFilter === filter.value }"
        @click="statusFilter = filter.value"
      >{{ filter.label }}</button>
    </div>
    <p class="muted filter-count" aria-live="polite">
      {{ filteredElections.length }} de {{ elections.length }} elecciones
    </p>
  </section>

  <div v-for="election in filteredElections" :key="election.id" class="card">
    <div class="row between">
      <h3>{{ election.title }}</h3>
      <span class="badge" :class="election.status">{{ statusLabels[election.status] }}</span>
    </div>
    <p class="muted">{{ election.description }}</p>
    <p class="muted"><b>Inicio:</b> {{ formatSchedule(election.starts_at) }} · <b>Cierre:</b> {{ formatSchedule(election.ends_at) }}</p>
    <div class="row between">
      <span class="muted">{{ election.total_votes }} votos</span>
      <button @click="go('detail', { id: election.id })">
        {{ election.status === 'open' ? 'Votar / ver conteo' : 'Ver detalle' }}
      </button>
    </div>
  </div>
  <div v-if="!error && elections.length === 0" class="card empty-elections">
    <h3>Aún no hay elecciones</h3>
    <p class="muted">Cuando se publiquen votaciones, aparecerán aquí.</p>
  </div>
  <div v-else-if="!error && filteredElections.length === 0" class="card empty-elections">
    <h3>No encontramos elecciones</h3>
    <p class="muted">Prueba con otro término o cambia el filtro de estado.</p>
    <button class="ghost" @click="search = ''; statusFilter = 'all'">Limpiar filtros</button>
  </div>
</template>

<style scoped>
.election-filters label {
  display: block;
}

.election-filters input {
  margin-bottom: 12px;
}

.status-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-filters button.selected {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
}

.filter-count {
  margin: 12px 0 0;
}

.empty-elections {
  text-align: center;
}

.empty-elections p {
  margin-bottom: 16px;
}
</style>
