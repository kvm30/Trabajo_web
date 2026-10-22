<script setup>
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  session: { type: Object, required: true },
  go: { type: Function, required: true },
  toast: { type: Function, required: true },
  refreshKey: { type: Number, required: true },
});

const elections = ref([]);
const title = ref('');
const description = ref('');
const candidateNames = ref({});
const error = ref('');
const loading = ref(false);
const creating = ref(false);
const addingCandidateId = ref(null);
const changingElectionId = ref(null);
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
const summary = computed(() => ({
  total: elections.value.length,
  open: elections.value.filter((election) => election.status === 'open').length,
  closed: elections.value.filter((election) => election.status === 'closed').length,
  votes: elections.value.reduce((total, election) => total + election.total_votes, 0),
}));

async function load() {
  error.value = '';
  loading.value = true;
  try {
    elections.value = await props.api('/elections');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createElection() {
  creating.value = true;
  try {
    await props.api('/elections', 'POST', { title: title.value, description: description.value });
    props.toast('Elección creada');
    title.value = '';
    description.value = '';
    await load();
  } catch (err) {
    props.toast(err.message);
  } finally {
    creating.value = false;
  }
}

async function addCandidate(electionId) {
  addingCandidateId.value = electionId;
  try {
    await props.api(`/elections/${electionId}/candidates`, 'POST', { name: candidateNames.value[electionId] || '' });
    props.toast('Candidato agregado');
    candidateNames.value[electionId] = '';
    await load();
  } catch (err) {
    props.toast(err.message);
  } finally {
    addingCandidateId.value = null;
  }
}

async function changeStatus(electionId, status) {
  const election = elections.value.find((item) => item.id === electionId);
  if (!election) return;
  if (status === 'open' && !election.total_candidates) {
    props.toast('Agrega al menos un candidato antes de abrir la elección');
    return;
  }

  const action = status === 'open'
    ? 'abrir'
    : status === 'closed'
      ? 'cerrar'
      : 'devolver a borrador';
  const consequence = status === 'open'
    ? 'Las personas podrán votar en esta elección.'
    : status === 'closed'
      ? 'Ya no se aceptarán más votos.'
      : 'La elección dejará de estar disponible para votar.';
  if (!window.confirm(`¿Deseas ${action} "${election.title}"? ${consequence}`)) return;

  changingElectionId.value = electionId;
  try {
    await props.api(`/elections/${electionId}/status`, 'PATCH', { status });
    props.toast(`Elección ${statusLabels[status].toLowerCase()}`);
    await load();
  } catch (err) {
    props.toast(err.message);
  } finally {
    changingElectionId.value = null;
  }
}

onMounted(() => {
  if (props.session?.user.role !== 'admin') props.go('elections');
  else load();
});
watch(() => props.refreshKey, load);
</script>

<template>
  <template v-if="session?.user.role === 'admin'">
    <div class="admin-heading">
      <h2>Panel de administración</h2>
      <p class="muted">Administra elecciones y revisa la participación.</p>
    </div>

    <section class="summary-grid" aria-label="Resumen de elecciones">
      <article class="summary-card">
        <span class="summary-value">{{ summary.total }}</span>
        <span class="muted">Elecciones totales</span>
      </article>
      <article class="summary-card">
        <span class="summary-value">{{ summary.open }}</span>
        <span class="muted">Abiertas</span>
      </article>
      <article class="summary-card">
        <span class="summary-value">{{ summary.closed }}</span>
        <span class="muted">Cerradas</span>
      </article>
      <article class="summary-card">
        <span class="summary-value">{{ summary.votes }}</span>
        <span class="muted">Votos emitidos</span>
      </article>
    </section>

    <form class="card" @submit.prevent="createElection">
      <h2>Nueva elección</h2>
      <label for="title">Título</label>
      <input id="title" v-model="title" required>
      <label for="description">Descripción</label>
      <textarea id="description" v-model="description" rows="2"></textarea>
      <button type="submit" :disabled="creating">{{ creating ? 'Creando…' : 'Crear elección' }}</button>
    </form>

    <div v-if="error" class="card msg bad" role="alert">{{ error }}</div>
    <p v-if="loading && elections.length === 0" class="muted" role="status">Cargando elecciones…</p>
    <p v-else-if="!error && elections.length === 0" class="card empty-state">Aún no hay elecciones. Crea la primera desde el formulario.</p>
    <article v-for="election in elections" :key="election.id" class="card election-card">
      <div class="row between">
        <h3 class="election-title">{{ election.title }}</h3>
        <span class="badge" :class="election.status">{{ statusLabels[election.status] }}</span>
      </div>
      <p v-if="election.description" class="muted">{{ election.description }}</p>
      <div class="election-metrics muted">
        <span>{{ election.total_candidates }} {{ election.total_candidates === 1 ? 'candidato' : 'candidatos' }}</span>
        <span>{{ election.total_votes }} {{ election.total_votes === 1 ? 'voto emitido' : 'votos emitidos' }}</span>
      </div>
      <form v-if="election.status === 'draft'" class="row" @submit.prevent="addCandidate(election.id)">
        <input
          v-model="candidateNames[election.id]"
          class="candidate-input"
          placeholder="Nombre del candidato"
          required
          :aria-label="`Nombre del candidato para ${election.title}`"
        >
        <button type="submit" :disabled="addingCandidateId === election.id">
          {{ addingCandidateId === election.id ? 'Agregando…' : '+ Candidato' }}
        </button>
      </form>
      <div class="row status-actions">
        <button
          v-for="status in ['draft', 'open', 'closed'].filter((item) => item !== election.status)"
          :key="status"
          :class="status === 'open' ? 'ok' : status === 'closed' ? 'danger' : 'ghost'"
          :disabled="changingElectionId === election.id"
          @click="changeStatus(election.id, status)"
        >{{ status === 'open' ? 'Abrir elección' : status === 'closed' ? 'Cerrar elección' : 'Volver a borrador' }}</button>
      </div>
    </article>
  </template>
</template>

<style scoped>
.admin-heading {
  margin-bottom: 18px;
}

.admin-heading h2,
.admin-heading p {
  margin-bottom: 4px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.summary-card {
  display: flex;
  min-height: 100px;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow);
}

.summary-value {
  color: var(--brand);
  font-size: 1.65rem;
  font-weight: 750;
  line-height: 1.2;
}

.election-card h3 {
  overflow-wrap: anywhere;
}

.election-title {
  margin-right: 12px;
}

.election-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  margin: 12px 0;
}

.empty-state {
  color: var(--muted);
}

.candidate-input {
  flex: 1;
  margin: 0;
}

.status-actions {
  margin-top: 10px;
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
