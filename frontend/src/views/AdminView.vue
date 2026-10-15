<script setup>
import { onMounted, ref, watch } from 'vue';

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
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };

async function load() {
  error.value = '';
  try {
    elections.value = await props.api('/elections');
  } catch (err) {
    error.value = err.message;
  }
}

async function createElection() {
  try {
    await props.api('/elections', 'POST', { title: title.value, description: description.value });
    props.toast('Creada');
    title.value = '';
    description.value = '';
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function addCandidate(electionId) {
  try {
    await props.api(`/elections/${electionId}/candidates`, 'POST', { name: candidateNames.value[electionId] || '' });
    props.toast('Candidato agregado');
    candidateNames.value[electionId] = '';
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function changeStatus(electionId, status) {
  try {
    await props.api(`/elections/${electionId}/status`, 'PATCH', { status });
    await load();
  } catch (err) {
    props.toast(err.message);
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
    <form class="card" @submit.prevent="createElection">
      <h2>Nueva elección</h2>
      <label for="title">Título</label>
      <input id="title" v-model="title" required>
      <label for="description">Descripción</label>
      <textarea id="description" v-model="description" rows="2"></textarea>
      <button type="submit">Crear</button>
    </form>

    <div v-if="error" class="card msg bad">{{ error }}</div>
    <div v-for="election in elections" :key="election.id" class="card">
      <div class="row between">
        <h3>{{ election.title }}</h3>
        <span class="badge" :class="election.status">{{ statusLabels[election.status] }}</span>
      </div>
      <form v-if="election.status === 'draft'" class="row" @submit.prevent="addCandidate(election.id)">
        <input
          v-model="candidateNames[election.id]"
          class="candidate-input"
          placeholder="Nombre del candidato"
          required
        >
        <button type="submit">+ Candidato</button>
      </form>
      <div class="row status-actions">
        <button
          v-for="status in ['draft', 'open', 'closed'].filter((item) => item !== election.status)"
          :key="status"
          :class="status === 'open' ? 'ok' : status === 'closed' ? 'danger' : 'ghost'"
          @click="changeStatus(election.id, status)"
        >→ {{ statusLabels[status] }}</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.candidate-input {
  flex: 1;
  margin: 0;
}

.status-actions {
  margin-top: 10px;
}
</style>
