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
const users = ref([]);
const userSearch = ref('');
const userRoleFilter = ref('all');
const userStatusFilter = ref('all');
const managingUserId = ref(null);
const title = ref('');
const description = ref('');
const startsAt = ref('');
const endsAt = ref('');
const candidateNames = ref({});
const error = ref('');
const loading = ref(false);
const creating = ref(false);
const addingCandidateId = ref(null);
const changingElectionId = ref(null);
const editingElectionId = ref(null);
const editTitle = ref('');
const editDescription = ref('');
const editStartsAt = ref('');
const editEndsAt = ref('');
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
function formatSchedule(value) {
  if (!value) return 'No definida';
  return new Date(value).toLocaleString();
}
const summary = computed(() => ({
  total: elections.value.length,
  open: elections.value.filter((election) => election.status === 'open').length,
  closed: elections.value.filter((election) => election.status === 'closed').length,
  votes: elections.value.reduce((total, election) => total + election.total_votes, 0),
}));
const filteredUsers = computed(() => {
  const search = userSearch.value.trim().toLowerCase();
  return users.value.filter((user) => {
    const matchesSearch = !search
      || user.name?.toLowerCase().includes(search)
      || user.email?.toLowerCase().includes(search);
    const matchesRole = userRoleFilter.value === 'all' || user.role === userRoleFilter.value;
    const matchesStatus = userStatusFilter.value === 'all'
      || (userStatusFilter.value === 'active' ? user.active !== false : user.active === false);
    return matchesSearch && matchesRole && matchesStatus;
  });
});

async function load() {
  error.value = '';
  loading.value = true;
  try {
    const [electionData, userData] = await Promise.all([
      props.api('/elections'),
      props.api('/users'),
    ]);
    elections.value = electionData;
    users.value = userData;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createElection() {
  creating.value = true;
  try {
    await props.api('/elections', 'POST', {
      title: title.value,
      description: description.value,
      starts_at: startsAt.value ? new Date(startsAt.value).toISOString() : null,
      ends_at: endsAt.value ? new Date(endsAt.value).toISOString() : null,
    });
    props.toast('Elección creada');
    title.value = '';
    description.value = '';
    startsAt.value = '';
    endsAt.value = '';
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

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function beginEdit(election) {
  editingElectionId.value = election.id;
  editTitle.value = election.title;
  editDescription.value = election.description || '';
  editStartsAt.value = toDatetimeLocal(election.starts_at);
  editEndsAt.value = toDatetimeLocal(election.ends_at);
}

async function saveElection(electionId) {
  try {
    await props.api(`/elections/${electionId}`, 'PUT', {
      title: editTitle.value,
      description: editDescription.value,
      starts_at: new Date(editStartsAt.value).toISOString(),
      ends_at: new Date(editEndsAt.value).toISOString(),
    });
    editingElectionId.value = null;
    props.toast('Elección actualizada');
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function deleteElection(election) {
  if (!window.confirm(`¿Eliminar permanentemente la elección "${election.title}"? Esta acción no se puede deshacer.`)) return;
  try {
    await props.api(`/elections/${election.id}`, 'DELETE');
    props.toast('Elección eliminada');
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function duplicateElection(election) {
  try {
    await props.api(`/elections/${election.id}/duplicate`, 'POST');
    props.toast('Elección duplicada para mañana');
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function editCandidate(electionId, candidate) {
  const name = window.prompt('Nombre del candidato', candidate.name);
  if (name === null || !name.trim()) return;
  const description = window.prompt('Descripción del candidato', candidate.description || '') ?? candidate.description;
  try {
    await props.api(`/elections/${electionId}/candidates/${candidate.id}`, 'PUT', { name: name.trim(), description });
    props.toast('Candidato actualizado');
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function deleteCandidate(electionId, candidate) {
  if (!window.confirm(`¿Eliminar al candidato "${candidate.name}"?`)) return;
  try {
    await props.api(`/elections/${electionId}/candidates/${candidate.id}`, 'DELETE');
    props.toast('Candidato eliminado');
    await load();
  } catch (err) {
    props.toast(err.message);
  }
}

async function changeUserRole(user, role) {
  if (!window.confirm(`¿Cambiar el rol de "${user.name}" a ${role === 'admin' ? 'administrador' : 'votante'}?`)) return;
  managingUserId.value = user.id;
  try {
    await props.api(`/users/${user.id}/role`, 'PATCH', { role });
    props.toast('Rol actualizado');
    await load();
  } catch (err) {
    props.toast(err.message);
  } finally {
    managingUserId.value = null;
  }
}

async function toggleUserActive(user) {
  const active = user.active === false;
  if (!window.confirm(active ? `¿Activar la cuenta de "${user.name}"?` : `¿Desactivar la cuenta de "${user.name}"?`)) return;
  managingUserId.value = user.id;
  try {
    await props.api(`/users/${user.id}/active`, 'PATCH', { active });
    props.toast(active ? 'Cuenta activada' : 'Cuenta desactivada');
    await load();
  } catch (err) {
    props.toast(err.message);
  } finally {
    managingUserId.value = null;
  }
}

async function deleteUser(user) {
  if (!window.confirm(`¿Eliminar permanentemente la cuenta de "${user.name}"? Esta acción no se puede deshacer.`)) return;
  managingUserId.value = user.id;
  try {
    await props.api(`/users/${user.id}`, 'DELETE');
    props.toast('Usuario eliminado');
    await load();
  } catch (err) {
    props.toast(err.message);
  } finally {
    managingUserId.value = null;
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
      <div class="row schedule-fields">
        <div>
          <label for="starts-at">Inicio</label>
          <input id="starts-at" v-model="startsAt" type="datetime-local" required>
        </div>
        <div>
          <label for="ends-at">Cierre</label>
          <input id="ends-at" v-model="endsAt" type="datetime-local" required>
        </div>
      </div>
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
      <form v-if="editingElectionId === election.id" class="card election-edit" @submit.prevent="saveElection(election.id)">
        <label :for="`edit-title-${election.id}`">Título</label>
        <input :id="`edit-title-${election.id}`" v-model="editTitle" required>
        <label :for="`edit-description-${election.id}`">Descripción</label>
        <textarea :id="`edit-description-${election.id}`" v-model="editDescription" rows="2"></textarea>
        <div class="row schedule-fields">
          <div><label :for="`edit-start-${election.id}`">Inicio</label><input :id="`edit-start-${election.id}`" v-model="editStartsAt" type="datetime-local" required></div>
          <div><label :for="`edit-end-${election.id}`">Cierre</label><input :id="`edit-end-${election.id}`" v-model="editEndsAt" type="datetime-local" required></div>
        </div>
        <div class="row"><button type="submit">Guardar cambios</button><button type="button" class="ghost" @click="editingElectionId = null">Cancelar</button></div>
      </form>
      <template v-else>
        <p v-if="election.description" class="muted">{{ election.description }}</p>
        <p class="muted schedule-label"><b>Inicio:</b> {{ formatSchedule(election.starts_at) }}<br><b>Cierre:</b> {{ formatSchedule(election.ends_at) }}</p>
      </template>
      <div class="election-metrics muted">
        <span>{{ election.total_candidates }} {{ election.total_candidates === 1 ? 'candidato' : 'candidatos' }}</span>
        <span>{{ election.total_votes }} {{ election.total_votes === 1 ? 'voto emitido' : 'votos emitidos' }}</span>
      </div>
      <div v-if="election.status === 'draft' && election.candidates?.length" class="candidate-list">
        <div v-for="candidate in election.candidates" :key="candidate.id" class="row between candidate-row">
          <span><b>{{ candidate.name }}</b><small v-if="candidate.description" class="muted"> — {{ candidate.description }}</small></span>
          <div class="row">
            <button type="button" class="ghost" @click="editCandidate(election.id, candidate)" :aria-label="`Editar ${candidate.name}`">Editar</button>
            <button type="button" class="danger" @click="deleteCandidate(election.id, candidate)" :aria-label="`Eliminar ${candidate.name}`">Eliminar</button>
          </div>
        </div>
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
      <div v-if="election.status === 'draft'" class="row election-management">
        <button class="ghost" type="button" @click="beginEdit(election)">Editar elección</button>
        <button class="ghost" type="button" @click="duplicateElection(election)">Duplicar</button>
        <button class="danger" type="button" @click="deleteElection(election)">Eliminar elección</button>
      </div>
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

    <section class="card user-management">
      <h2>Administración de usuarios</h2>
      <div class="row user-filters">
        <input v-model="userSearch" type="search" placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios">
        <select v-model="userRoleFilter" aria-label="Filtrar por rol">
          <option value="all">Todos los roles</option>
          <option value="voter">Votantes</option>
          <option value="admin">Administradores</option>
        </select>
        <select v-model="userStatusFilter" aria-label="Filtrar por estado">
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="inactive">Desactivadas</option>
        </select>
      </div>
      <p v-if="!loading && filteredUsers.length === 0" class="muted">No hay usuarios que coincidan con los filtros.</p>
      <div v-for="user in filteredUsers" :key="user.id" class="user-row">
        <div class="user-info">
          <b>{{ user.name }}</b>
          <span class="muted">{{ user.email }}</span>
        </div>
        <div class="row user-actions">
          <select
            :value="user.role"
            :disabled="managingUserId === user.id || user.id === session.user.id"
            :aria-label="`Rol de ${user.name}`"
            @change="changeUserRole(user, $event.target.value)"
          >
            <option value="voter">Votante</option>
            <option value="admin">Administrador</option>
          </select>
          <button
            class="ghost"
            :disabled="managingUserId === user.id || user.id === session.user.id"
            @click="toggleUserActive(user)"
          >{{ user.active === false ? 'Activar' : 'Desactivar' }}</button>
          <button
            class="danger"
            :disabled="managingUserId === user.id || user.id === session.user.id"
            @click="deleteUser(user)"
          >Eliminar</button>
        </div>
      </div>
    </section>
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

.election-edit {
  margin: 12px 0;
  box-shadow: none;
}

.election-management {
  margin-top: 12px;
}

.candidate-list {
  margin-bottom: 10px;
}

.candidate-row {
  padding: 8px 0;
  border-top: 1px solid var(--line);
}

.user-management {
  margin-top: 18px;
}

.user-filters {
  gap: 10px;
  margin-bottom: 12px;
}

.user-filters input {
  flex: 1;
}

.user-filters select {
  width: auto;
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}

.user-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.user-info span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-actions {
  flex-shrink: 0;
  gap: 8px;
}

.schedule-fields {
  align-items: flex-end;
  gap: 12px;
}

.schedule-fields > div {
  flex: 1;
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .user-row,
  .user-filters {
    align-items: stretch;
    flex-direction: column;
  }

  .user-filters select,
  .user-actions select {
    width: 100%;
  }
}
</style>
