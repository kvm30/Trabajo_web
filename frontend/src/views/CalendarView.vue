<script setup>
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  go: { type: Function, required: true },
  refreshKey: { type: Number, required: true },
});

const elections = ref([]);
const error = ref('');

const upcoming = computed(() => elections.value
  .filter((election) => election.status === 'draft')
  .sort((left, right) => new Date(left.starts_at || 0) - new Date(right.starts_at || 0)));
const active = computed(() => elections.value
  .filter((election) => election.status === 'open')
  .sort((left, right) => new Date(left.ends_at || 0) - new Date(right.ends_at || 0)));
const past = computed(() => elections.value
  .filter((election) => election.status === 'closed')
  .sort((left, right) => new Date(right.ends_at || 0) - new Date(left.ends_at || 0)));

function formatSchedule(value) {
  if (!value) return 'Fecha por definir';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
  <h2>Calendario de elecciones</h2>
  <p class="muted">Consulta las próximas fechas, las votaciones activas y las elecciones finalizadas.</p>
  <div v-if="error" class="card msg bad" role="alert">{{ error }}</div>
  <p v-else-if="!elections.length" class="card empty-state">Aún no hay elecciones en el calendario.</p>

  <section v-if="upcoming.length" aria-labelledby="calendar-upcoming">
    <h3 id="calendar-upcoming">Próximas</h3>
    <article v-for="election in upcoming" :key="election.id" class="card calendar-election">
      <div class="row between">
        <h4>{{ election.title }}</h4>
        <span class="badge draft">Próxima</span>
      </div>
      <p class="muted">{{ election.description }}</p>
      <p><strong>Inicia:</strong> {{ formatSchedule(election.starts_at) }}</p>
      <p><strong>Cierra:</strong> {{ formatSchedule(election.ends_at) }}</p>
      <button type="button" class="ghost" @click="go('detail', { id: election.id })">Ver información</button>
    </article>
  </section>

  <section v-if="active.length" aria-labelledby="calendar-active">
    <h3 id="calendar-active">En curso</h3>
    <article v-for="election in active" :key="election.id" class="card calendar-election">
      <div class="row between">
        <h4>{{ election.title }}</h4>
        <span class="badge open">Abierta</span>
      </div>
      <p class="muted">{{ election.description }}</p>
      <p><strong>Cierra:</strong> {{ formatSchedule(election.ends_at) }}</p>
      <button type="button" @click="go('detail', { id: election.id })">Ir a la elección</button>
    </article>
  </section>

  <section v-if="past.length" aria-labelledby="calendar-past">
    <h3 id="calendar-past">Finalizadas</h3>
    <article v-for="election in past" :key="election.id" class="card calendar-election">
      <div class="row between">
        <h4>{{ election.title }}</h4>
        <span class="badge closed">Cerrada</span>
      </div>
      <p><strong>Cerró:</strong> {{ formatSchedule(election.ends_at) }}</p>
      <button type="button" class="ghost" @click="go('detail', { id: election.id })">Ver resultados</button>
    </article>
  </section>
</template>

<style scoped>
.calendar-election h4 {
  margin: 0;
  overflow-wrap: anywhere;
}

.calendar-election p {
  margin-bottom: 8px;
}
</style>
