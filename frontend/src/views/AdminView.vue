<script setup>
import { nextTick, onMounted, reactive, ref, watch } from 'vue';

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
const startsAt = ref('');
const endsAt = ref('');
const candidateNames = ref({});
const scheduleDrafts = reactive({});
const printElection = ref(null);
const error = ref('');
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toUtcIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function refreshScheduleDrafts() {
  for (const election of elections.value) {
    scheduleDrafts[election.id] = {
      starts_at: toLocalDateTime(election.starts_at),
      ends_at: toLocalDateTime(election.ends_at),
    };
  }
}

async function load() {
  error.value = '';
  try {
    elections.value = await props.api('/elections');
    refreshScheduleDrafts();
  } catch (err) {
    error.value = err.message;
  }
}

async function createElection() {
  if (Boolean(startsAt.value) !== Boolean(endsAt.value)) {
    props.toast('Completa ambas fechas o deja las dos vacías');
    return;
  }
  if (startsAt.value && new Date(endsAt.value) <= new Date(startsAt.value)) {
    props.toast('La fecha de cierre debe ser posterior al inicio');
    return;
  }
  try {
    await props.api('/elections', 'POST', {
      title: title.value,
      description: description.value,
      ...(startsAt.value && {
        starts_at: toUtcIso(startsAt.value),
        ends_at: toUtcIso(endsAt.value),
      }),
    });
    props.toast('Elección creada');
    title.value = '';
    description.value = '';
    startsAt.value = '';
    endsAt.value = '';
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function scheduleElection(electionId) {
  const schedule = scheduleDrafts[electionId];
  if (!schedule?.starts_at || !schedule.ends_at) {
    props.toast('Completa las fechas de inicio y cierre');
    return;
  }
  if (new Date(schedule.ends_at) <= new Date(schedule.starts_at)) {
    props.toast('La fecha de cierre debe ser posterior al inicio');
    return;
  }
  try {
    await props.api(`/elections/${electionId}/schedule`, 'PATCH', {
      starts_at: toUtcIso(schedule.starts_at),
      ends_at: toUtcIso(schedule.ends_at),
    });
    props.toast('Calendario actualizado');
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

function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\u0000-\u0020]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function safeFileName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'eleccion';
}

function exportCsv(election) {
  try {
    const rows = [
      ['Elección', election.title],
      ['Estado', statusLabels[election.status]],
      ['Votos totales', election.total_votes],
      ['Participación', `${election.participation_count}/${election.eligible_voters} (${election.participation_rate}%)`],
      [],
      ['Candidato', 'Votos', 'Porcentaje'],
      ...election.candidates.map((candidate) => [
        candidate.name,
        candidate.votes,
        `${election.total_votes ? Math.round(candidate.votes / election.total_votes * 10000) / 100 : 0}%`,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(election.title)}-resultados.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    props.toast(err.message);
  }
}

function exportPdf(election) {
  printElection.value = { ...election, total: election.total_votes };
  nextTick()
    .then(() => window.print())
    .catch((err) => props.toast(err.message));
}

onMounted(() => {
  if (props.session?.user.role !== 'admin') props.go('elections');
  else load();
});
watch(() => props.refreshKey, load);
</script>

<template>
  <template v-if="session?.user.role === 'admin'">
    <div class="admin-heading row between">
      <div>
        <h2>Panel de administración</h2>
        <p class="muted">Resumen de participación y estado de las elecciones.</p>
      </div>
    </div>

    <div class="admin-summary" aria-label="Resumen general">
      <article class="card summary-card">
        <span class="muted">Elecciones</span>
        <strong>{{ elections.length }}</strong>
      </article>
      <article class="card summary-card">
        <span class="muted">Votos emitidos</span>
        <strong>{{ elections.reduce((sum, election) => sum + election.total_votes, 0) }}</strong>
      </article>
      <article class="card summary-card">
        <span class="muted">Cuentas votantes</span>
        <strong>{{ elections[0]?.eligible_voters ?? 0 }}</strong>
      </article>
    </div>

    <form class="card" @submit.prevent="createElection">
      <h2>Nueva elección</h2>
      <label for="title">Título</label>
      <input id="title" v-model="title" required maxlength="200">
      <label for="description">Descripción</label>
      <textarea id="description" v-model="description" rows="2"></textarea>
      <fieldset class="schedule-fields">
        <legend>Calendario opcional</legend>
        <p class="muted">Si defines fechas, la votación se abre y cierra automáticamente.</p>
        <div class="date-grid">
          <div>
            <label for="new-starts-at">Inicio</label>
            <input id="new-starts-at" v-model="startsAt" type="datetime-local">
          </div>
          <div>
            <label for="new-ends-at">Cierre</label>
            <input id="new-ends-at" v-model="endsAt" type="datetime-local">
          </div>
        </div>
      </fieldset>
      <button type="submit">Crear elección</button>
    </form>

    <div v-if="error" class="card msg bad" role="alert">{{ error }}</div>
    <p v-if="!error && elections.length === 0" class="muted">Aún no hay elecciones.</p>

    <section aria-labelledby="elections-heading">
      <h2 id="elections-heading">Elecciones y participación</h2>
      <article v-for="election in elections" :key="election.id" class="card admin-election">
        <div class="row between">
          <div>
            <h3>{{ election.title }}</h3>
            <p class="muted">{{ election.description }}</p>
          </div>
          <span class="badge" :class="election.status" :aria-label="`Estado: ${statusLabels[election.status]}`">
            {{ statusLabels[election.status] }}
          </span>
        </div>

        <div class="participation-summary">
          <div class="row between">
            <span>{{ election.total_votes }} votos · {{ election.participation_count }} de {{ election.eligible_voters }} votantes participaron</span>
            <strong>{{ election.participation_rate }}%</strong>
          </div>
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
        </div>

        <p v-if="election.starts_at" class="muted">
          Inicio: {{ new Date(election.starts_at).toLocaleString() }}
          <span v-if="election.ends_at"> · Cierre: {{ new Date(election.ends_at).toLocaleString() }}</span>
        </p>

        <form
          v-if="election.status === 'draft' && election.total_votes === 0"
          class="schedule-fields"
          @submit.prevent="scheduleElection(election.id)"
        >
          <fieldset>
            <legend>Programar fechas</legend>
            <div class="date-grid">
              <div>
                <label :for="`starts-at-${election.id}`">Inicio</label>
                <input
                  :id="`starts-at-${election.id}`"
                  v-model="scheduleDrafts[election.id].starts_at"
                  type="datetime-local"
                  required
                >
              </div>
              <div>
                <label :for="`ends-at-${election.id}`">Cierre</label>
                <input
                  :id="`ends-at-${election.id}`"
                  v-model="scheduleDrafts[election.id].ends_at"
                  type="datetime-local"
                  required
                >
              </div>
            </div>
            <button type="submit" class="ghost">Guardar calendario</button>
          </fieldset>
        </form>

        <form v-if="election.status === 'draft'" class="row candidate-form" @submit.prevent="addCandidate(election.id)">
          <label class="sr-only" :for="`candidate-${election.id}`">Nombre del nuevo candidato</label>
          <input
            :id="`candidate-${election.id}`"
            v-model="candidateNames[election.id]"
            class="candidate-input"
            placeholder="Nombre del candidato"
            required
          >
          <button type="submit">+ Candidato</button>
        </form>

        <div class="row status-actions">
          <button
            v-for="status in ['draft', 'open', 'closed'].filter((item) => (
              item !== election.status && (!election.starts_at || item === 'closed')
            ))"
            :key="status"
            :class="status === 'open' ? 'ok' : status === 'closed' ? 'danger' : 'ghost'"
            @click="changeStatus(election.id, status)"
          >→ {{ statusLabels[status] }}</button>
          <button class="ghost" @click="exportCsv(election)">Descargar CSV</button>
          <button class="ghost" @click="exportPdf(election)">Imprimir / Guardar PDF</button>
        </div>
      </article>
    </section>

    <section v-if="printElection" id="print-report" class="print-report" aria-label="Reporte de resultados">
      <h1>Resultados: {{ printElection.title }}</h1>
      <p>{{ printElection.description }}</p>
      <p>Estado: {{ statusLabels[printElection.status] }}</p>
      <p>Votos: {{ printElection.total }}</p>
      <p>
        Participación: {{ printElection.participation_count }} de {{ printElection.eligible_voters }}
        votantes ({{ printElection.participation_rate }}%)
      </p>
      <table>
        <thead><tr><th>Candidato</th><th>Votos</th><th>Porcentaje</th></tr></thead>
        <tbody>
          <tr v-for="candidate in printElection.candidates" :key="candidate.id">
            <td>{{ candidate.name }}</td>
            <td>{{ candidate.votes }}</td>
            <td>{{ printElection.total ? Math.round(candidate.votes / printElection.total * 10000) / 100 : 0 }}%</td>
          </tr>
        </tbody>
      </table>
      <p>Generado: {{ new Date().toLocaleString() }}</p>
    </section>
  </template>
</template>

<style scoped>
.admin-heading {
  margin-bottom: 16px;
}

.admin-heading h2,
.admin-heading p,
.admin-election p {
  margin-top: 0;
}

.admin-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.summary-card strong {
  font-size: 1.7rem;
}

.schedule-fields {
  margin: 16px 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.schedule-fields legend {
  padding: 0 6px;
  font-weight: 600;
}

.schedule-fields p {
  margin-bottom: 10px;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.date-grid input {
  margin-bottom: 8px;
}

.participation-summary {
  margin: 12px 0;
}

.participation-track {
  height: 10px;
  margin-top: 8px;
  overflow: hidden;
  background: var(--line);
  border-radius: 99px;
}

.participation-track div {
  height: 100%;
  background: var(--brand);
}

.candidate-form {
  margin-top: 12px;
}

.candidate-input {
  flex: 1;
  margin: 0;
}

.status-actions {
  margin-top: 10px;
}

.print-report {
  display: none;
}

.print-report table {
  width: 100%;
  border-collapse: collapse;
}

.print-report th,
.print-report td {
  padding: 8px;
  border: 1px solid #777;
  text-align: left;
}

@media (max-width: 600px) {
  .admin-summary,
  .date-grid {
    grid-template-columns: 1fr;
  }

  .status-actions > button,
  .candidate-form > button {
    flex: 1 1 100%;
  }
}

@media print {
  :global(body *) {
    visibility: hidden !important;
  }

  .print-report,
  .print-report * {
    visibility: visible !important;
  }

  .print-report {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    padding: 24px;
    color: #111;
    background: #fff;
  }
}
</style>
