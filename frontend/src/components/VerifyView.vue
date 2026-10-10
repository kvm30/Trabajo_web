<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  view: { type: Object, required: true },
});

const hash = ref(props.view.hash || '');
const result = ref(null);
const error = ref('');
const busy = ref(false);

async function check() {
  error.value = '';
  result.value = null;
  busy.value = true;
  try {
    result.value = await props.api('/audit/verify/' + hash.value.trim());
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (props.view.hash) check();
});
</script>

<template>
  <form class="card" @submit.prevent="check">
    <h2>Verificación ciudadana</h2>
    <p class="muted">
      Pega tu comprobante SHA256 para confirmar que tu voto está en la cadena. No requiere iniciar sesión.
    </p>
    <input
      v-model="hash"
      placeholder="64 caracteres hexadecimales"
      aria-label="Comprobante SHA256"
      required
    >
    <button type="submit" :disabled="busy">Verificar</button>
    <div v-if="error" class="msg bad">{{ error }}</div>
    <div v-if="result?.counted" class="msg ok">
      ✅ Voto CONTADO en «{{ result.election_title }}»<br>
      Posición #{{ result.position }} · {{ new Date(result.created_at).toLocaleString() }}
      <div class="hash">{{ result.chain_hash }}</div>
    </div>
    <div v-else-if="result" class="msg bad">❌ Comprobante no encontrado.</div>
  </form>
</template>
