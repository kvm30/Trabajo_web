<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  view: { type: Object, required: true },
  session: { type: Object, default: null },
  go: { type: Function, required: true },
  toast: { type: Function, required: true },
  joinRoom: { type: Function, required: true },
  liveResults: { type: Object, default: null },
  refreshKey: { type: Number, required: true },
});

const election = ref(null);
const results = ref(null);
const voted = ref(false);
const selectedCandidate = ref('');
const receipt = ref(null);
const auditMessage = ref(null);
const chainRows = ref([]);
const chainVisible = ref(false);
const error = ref('');
const busy = ref(false);
const statusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
const savedReceiptKey = computed(() => props.session
  ? `receipt:${props.session.user.id}:${props.view.id}`
  : null);

function updateResults(data) {
  results.value = data;
}

async function load() {
  error.value = '';
  try {
    const currentElection = await props.api('/elections/' + props.view.id);
    election.value = currentElection;
    results.value = currentElection;
    props.joinRoom(currentElection.id);
    voted.value = props.session
      ? (await props.api(`/elections/${currentElection.id}/has-voted`)).voted
      : false;
    selectedCandidate.value = '';
    const saved = savedReceiptKey.value && localStorage.getItem(savedReceiptKey.value);
    receipt.value = saved ? JSON.parse(saved) : null;
  } catch (err) {
    error.value = err.message;
  }
}

async function vote() {
  if (!selectedCandidate.value) {
    props.toast('Elige un candidato');
    return;
  }
  if (!confirm('Tu voto es definitivo y anónimo. ¿Confirmar?')) return;

  busy.value = true;
  try {
    const savedReceipt = await props.api(`/elections/${election.value.id}/vote`, 'POST', {
      candidate_id: Number(selectedCandidate.value),
    });
    localStorage.setItem(savedReceiptKey.value, JSON.stringify(savedReceipt));
    receipt.value = savedReceipt;
    voted.value = true;
    props.toast('Voto registrado');
  } catch (err) {
    props.toast(err.message);
  } finally {
    busy.value = false;
  }
}

async function verifyIntegrity() {
  auditMessage.value = null;
  chainRows.value = [];
  chainVisible.value = false;
  try {
    const result = await props.api(`/audit/${election.value.id}/integrity`);
    auditMessage.value = result.valid
      ? { type: 'ok', text: `✅ Cadena íntegra: ${result.checked} votos verificados.`, hash: result.head_hash || '—' }
      : { type: 'bad', text: `⚠️ Cadena ROTA en el voto #${result.broken_at_position}. Hubo manipulación.` };
  } catch (err) {
    props.toast(err.message);
  }
}

async function showChain() {
  auditMessage.value = null;
  chainVisible.value = true;
  try {
    chainRows.value = await props.api(`/audit/${election.value.id}/chain`);
  } catch (err) {
    props.toast(err.message);
  }
}

async function copyReceipt() {
  try {
    await navigator.clipboard.writeText(receipt.value.receipt_hash);
    props.toast('Copiado');
  } catch (err) {
    props.toast(err.message);
  }
}

onMounted(load);
onBeforeUnmount(() => props.joinRoom(null));
watch(() => props.refreshKey, load);
watch(() => props.liveResults, (data) => {
  if (data && Number(data.electionId) === Number(election.value?.id)) updateResults(data);
});
</script>

<template>
  <div v-if="error" class="card msg bad">{{ error }}</div>
  <template v-else-if="election">
    <button class="ghost" @click="go('elections')">← Volver</button>
    <div class="card detail-heading">
      <div class="row between">
        <h2>{{ election.title }}</h2>
        <span class="badge" :class="election.status">{{ statusLabels[election.status] }}</span>
      </div>
      <p class="muted">{{ election.description }}</p>
    </div>

    <div class="card">
      <div class="row between">
        <h3><span class="live"></span>Conteo en vivo</h3>
        <span class="muted">Total: <b>{{ results?.total ?? 0 }}</b></span>
      </div>
      <div v-if="results?.candidates?.length">
        <div v-for="candidate in results.candidates" :key="candidate.id" class="result-row">
          <div class="row between">
            <b>{{ candidate.name }}</b>
            <span>{{ candidate.votes }} ({{ results.total ? Math.round(candidate.votes / results.total * 100) : 0 }}%)</span>
          </div>
          <div class="bar">
            <div :style="{ width: `${results.total ? Math.round(candidate.votes / results.total * 100) : 0}%` }"></div>
          </div>
        </div>
      </div>
      <p v-else class="muted">Sin candidatos.</p>
    </div>

    <div class="card">
      <template v-if="election.status === 'open'">
        <p v-if="!session" class="muted">Inicia sesión para votar.</p>
        <div v-else-if="voted" class="msg ok">✅ Ya votaste en esta elección.</div>
        <template v-else>
          <h3>Tu voto (secreto)</h3>
          <label
            v-for="candidate in election.candidates"
            :key="candidate.id"
            class="cand"
            :class="{ sel: selectedCandidate === String(candidate.id) }"
          >
            <input v-model="selectedCandidate" type="radio" name="candidate" :value="String(candidate.id)">
            {{ candidate.name }}
            <div class="muted">{{ candidate.description }}</div>
          </label>
          <button :disabled="busy" @click="vote">Emitir voto</button>
        </template>
      </template>
      <div v-else class="msg" :class="{ bad: election.status === 'closed' }">
        Elección {{ statusLabels[election.status].toLowerCase() }}.
      </div>
    </div>

    <div v-if="receipt" class="card receipt">
      <h3>🧾 Tu comprobante anónimo</h3>
      <p class="muted">
        Guárdalo: sirve para verificar que tu voto fue contado. No revela por quién votaste ni quién eres.
      </p>
      <div class="hash">{{ receipt.receipt_hash }}</div>
      <p class="muted">
        Voto #{{ receipt.position }} · {{ new Date(receipt.created_at).toLocaleString() }}
      </p>
      <button class="ghost" @click="copyReceipt">Copiar</button>
      <button class="ghost" @click="go('verify', { hash: receipt.receipt_hash })">Verificar ahora</button>
    </div>

    <div class="card">
      <h3>Auditoría pública</h3>
      <p class="muted">
        Cada voto se encadena con el anterior mediante SHA256. Cualquiera puede comprobar que nada fue alterado.
      </p>
      <button class="ghost" @click="verifyIntegrity">Verificar integridad de la cadena</button>
      <button class="ghost" @click="showChain">Ver cadena de comprobantes</button>
      <div v-if="auditMessage" class="msg" :class="auditMessage.type">
        {{ auditMessage.text }}
        <div v-if="auditMessage.hash" class="hash">Hash final: {{ auditMessage.hash }}</div>
      </div>
      <div v-if="chainVisible" class="list">
        <div v-for="(row, index) in chainRows" :key="row.receipt_hash">
          #{{ index + 1 }} {{ row.receipt_hash }}
        </div>
        <span v-if="chainRows.length === 0">Sin votos</span>
      </div>
    </div>
  </template>
</template>

<style scoped>
.detail-heading {
  margin-top: 12px;
}

.result-row {
  margin-bottom: 12px;
}

.receipt {
  border-color: var(--ok);
}
</style>
