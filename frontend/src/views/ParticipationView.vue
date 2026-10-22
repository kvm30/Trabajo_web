<script setup>
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  refreshKey: { type: Number, required: true },
});

const summary = ref(null);
const loading = ref(false);
const error = ref('');

async function load() {
  if (props.session?.user.role !== 'voter') {
    props.go('elections');
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    summary.value = await props.api('/elections/participation');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.refreshKey, load);
</script>

<template>
  <section class="participation-heading">
    <h2>Participación general</h2>
    <p class="muted">
      Consulta cifras agregadas de participación. No se muestran identidades de votantes
      ni se relaciona a ninguna persona con su voto.
    </p>
  </section>

  <div v-if="error" class="card msg bad" role="alert">{{ error }}</div>
  <p v-if="loading && !summary" class="muted" role="status">Cargando estadísticas…</p>

  <template v-if="summary">
    <section class="participation-metrics" aria-label="Resumen agregado">
      <article class="participation-metric card">
        <strong>{{ summary.election_count }}</strong>
        <span class="muted">Elecciones</span>
      </article>
      <article class="participation-metric card">
        <strong>{{ summary.total_votes }}</strong>
        <span class="muted">Votos emitidos</span>
      </article>
      <article class="participation-metric card">
        <strong>{{ summary.participation_rate }}%</strong>
        <span class="muted">Participación general</span>
      </article>
      <article class="participation-metric card">
        <strong>{{ summary.participation_count }} / {{ summary.eligible_votes }}</strong>
        <span class="muted">Participaciones / cupos</span>
      </article>
    </section>

    <section aria-labelledby="participation-elections-heading">
      <h2 id="participation-elections-heading">Por elección</h2>
      <article v-for="election in summary.elections" :key="election.id" class="card participation-election">
        <div class="row between">
          <h3>{{ election.title }}</h3>
          <span class="badge" :class="election.status">
            {{ election.status === 'open' ? 'Abierta' : election.status === 'closed' ? 'Cerrada' : 'Borrador' }}
          </span>
        </div>
        <p class="muted">
          {{ election.participation_count }} de {{ election.eligible_voters }} cuentas votantes participaron
          · {{ election.total_votes }} votos
        </p>
        <div
          class="participation-track"
          role="progressbar"
          :aria-label="`Participación de ${election.title}`"
          :aria-valuenow="election.participation_rate"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div :style="{ width: `${Math.min(election.participation_rate, 100)}%` }"></div>
        </div>
        <strong>{{ election.participation_rate }}%</strong>
      </article>
      <p v-if="summary.elections.length === 0" class="card empty-state">
        Aún no hay elecciones para mostrar.
      </p>
    </section>
  </template>
</template>

<style scoped>
.participation-heading {
  margin-bottom: 18px;
}

.participation-heading h2,
.participation-heading p {
  margin-bottom: 6px;
}

.participation-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.participation-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.participation-metric strong {
  overflow-wrap: anywhere;
  color: var(--brand);
  font-size: 1.5rem;
}

.participation-election h3 {
  overflow-wrap: anywhere;
}

.participation-election > strong {
  display: inline-block;
  margin-top: 8px;
}

.participation-track {
  height: 10px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--line);
}

.participation-track div {
  height: 100%;
  background: var(--brand);
}

@media (max-width: 640px) {
  .participation-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
