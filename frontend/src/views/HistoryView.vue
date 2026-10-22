<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  session: { type: Object, default: null },
  go: { type: Function, required: true },
});

const entries = ref([]);
const loading = ref(false);
const error = ref('');

async function verifyReceipt(storageKey) {
  const electionId = Number(storageKey.slice(`receipt:${props.session.user.id}:`.length));
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || typeof saved.receipt_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(saved.receipt_hash)) {
      return { electionId, status: 'invalid', message: 'El comprobante guardado no tiene un formato válido.' };
    }

    const result = await props.api(`/audit/verify/${saved.receipt_hash}`);
    if (!result.counted || Number(result.election_id) !== electionId) {
      return {
        electionId,
        hash: saved.receipt_hash,
        status: 'not-found',
        message: 'El comprobante no aparece en la cadena de votos.',
      };
    }

    return {
      electionId,
      hash: saved.receipt_hash,
      title: result.election_title,
      position: result.position,
      createdAt: result.created_at,
      status: 'counted',
    };
  } catch (err) {
    return { electionId, status: 'error', message: err.message };
  }
}

async function loadHistory() {
  if (!props.session?.user?.id) {
    props.go('login');
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const prefix = `receipt:${props.session.user.id}:`;
    const keys = Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .sort((left, right) => Number(right.slice(prefix.length)) - Number(left.slice(prefix.length)));
    entries.value = await Promise.all(keys.map(verifyReceipt));
    entries.value.sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });
  } catch (err) {
    error.value = `No se pudo cargar tu historial: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

onMounted(loadHistory);
</script>

<template>
  <section class="history-heading">
    <h2>Mi historial de votos</h2>
    <p class="muted">
      Aquí puedes revisar y verificar los comprobantes de los votos emitidos desde este navegador.
      El historial no muestra por quién votaste.
    </p>
  </section>

  <div class="card msg" role="note">
    Por privacidad, los comprobantes se guardan en este navegador y no se asocian con tu cuenta en el servidor.
    Si borras los datos del navegador o usas otro dispositivo, no aparecerán aquí.
  </div>

  <div v-if="error" class="card msg bad" role="alert">{{ error }}</div>
  <p v-if="loading" class="muted" role="status">Verificando tus comprobantes…</p>

  <article v-for="entry in entries" :key="entry.electionId" class="card history-entry">
    <div class="row between">
      <div>
        <h3>{{ entry.title || `Elección #${entry.electionId}` }}</h3>
        <p v-if="entry.status === 'counted'" class="muted">
          Voto #{{ entry.position }} · {{ new Date(entry.createdAt).toLocaleString() }}
        </p>
      </div>
      <span v-if="entry.status === 'counted'" class="badge open">Voto verificado</span>
      <span v-else-if="entry.status === 'error'" class="badge draft">Error al verificar</span>
      <span v-else class="badge closed">No verificado</span>
    </div>

    <p v-if="entry.message" class="muted" role="status">{{ entry.message }}</p>
    <template v-if="entry.hash">
      <div class="hash">{{ entry.hash }}</div>
      <button
        v-if="entry.status === 'counted'"
        class="ghost"
        @click="go('verify', { hash: entry.hash })"
      >Ver comprobante</button>
    </template>
    <button v-if="entry.status === 'error'" class="ghost" @click="loadHistory">Intentar de nuevo</button>
  </article>

  <div v-if="!loading && !error && entries.length === 0" class="card empty-history">
    <h3>Aún no tienes comprobantes guardados</h3>
    <p class="muted">Cuando votes desde este navegador, podrás consultar aquí tu comprobante.</p>
    <button @click="go('elections')">Ver elecciones</button>
  </div>
</template>

<style scoped>
.history-heading {
  margin-bottom: 18px;
}

.history-heading h2,
.history-heading p {
  margin-bottom: 6px;
}

.history-entry h3 {
  margin-bottom: 4px;
  overflow-wrap: anywhere;
}

.history-entry .hash {
  margin-bottom: 12px;
}

.empty-history {
  text-align: center;
}

.empty-history p {
  margin-bottom: 16px;
}
</style>
