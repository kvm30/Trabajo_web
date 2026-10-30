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
const sortOrder = ref('status');
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
const statusFilters = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'closed', label: 'Cerradas' },
];
const electionStats = computed(() => ({
  open: elections.value.filter((election) => election.status === 'open').length,
  draft: elections.value.filter((election) => election.status === 'draft').length,
  closed: elections.value.filter((election) => election.status === 'closed').length,
}));
const filteredElections = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = elections.value.filter((election) => {
    const matchesStatus = statusFilter.value === 'all' || election.status === statusFilter.value;
    const searchableText = `${election.title ?? ''} ${election.description ?? ''}`.toLocaleLowerCase();
    return matchesStatus && searchableText.includes(query);
  });

  return filtered.sort((left, right) => {
    if (sortOrder.value === 'votes') {
      return (Number(right.total_votes) || 0) - (Number(left.total_votes) || 0)
        || left.title.localeCompare(right.title);
    }
    if (sortOrder.value === 'name') {
      return left.title.localeCompare(right.title);
    }

    const statusPriority = { open: 0, draft: 1, closed: 2 };
    return (statusPriority[left.status] ?? 3) - (statusPriority[right.status] ?? 3)
      || left.title.localeCompare(right.title);
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

  <section v-if="elections.length" class="election-stats" aria-label="Resumen de elecciones">
    <article class="card stat-card">
      <span class="badge open">Abiertas</span>
      <strong>{{ electionStats.open }}</strong>
      <span class="muted">Reciben votos</span>
    </article>
    <article class="card stat-card">
      <span class="badge draft">Borradores</span>
      <strong>{{ electionStats.draft }}</strong>
      <span class="muted">En preparación</span>
    </article>
    <article class="card stat-card">
      <span class="badge closed">Cerradas</span>
      <strong>{{ electionStats.closed }}</strong>
      <span class="muted">Votación finalizada</span>
    </article>
  </section>

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
    <label class="sort-label" for="election-sort">Ordenar resultados</label>
    <select id="election-sort" v-model="sortOrder">
      <option value="status">Abiertas primero</option>
      <option value="votes">Más votos</option>
      <option value="name">Nombre (A-Z)</option>
    </select>
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
.election-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 18px;
}

.stat-card strong {
  font-size: 1.8rem;
  line-height: 1.2;
}

.stat-card .muted {
  margin: 0;
}

.election-filters label {
  display: block;
}

.election-filters input {
  margin-bottom: 12px;
}

.sort-label {
  margin-top: 16px;
}

.election-filters select {
  width: 100%;
  margin-top: 5px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
}

.election-filters select:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--brand) 42%, transparent);
  outline-offset: 3px;
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

@media (max-width: 520px) {
  .election-stats {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
