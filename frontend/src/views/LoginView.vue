<script setup>
import { ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  view: { type: Object, required: true },
  go: { type: Function, required: true },
  setSession: { type: Function, required: true },
});

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);
const register = props.view.register;

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    const body = {
      email: email.value,
      password: password.value,
      ...(register && { name: name.value }),
    };
    const data = await props.api(register ? '/auth/register' : '/auth/login', 'POST', body);
    props.setSession({ token: data.token, user: data.user });
    props.go('elections');
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="card login-card" @submit.prevent="submit">
    <h2>{{ register ? 'Crear cuenta' : 'Ingresar' }}</h2>
    <label v-if="register" for="name">Nombre</label>
    <input v-if="register" id="name" v-model="name" autocomplete="name" required>
    <label for="email">Email</label>
    <input id="email" v-model="email" type="email" autocomplete="email" required>
    <label for="password">Contraseña</label>
    <input
      id="password"
      v-model="password"
      type="password"
      :autocomplete="register ? 'new-password' : 'current-password'"
      required
    >
    <div class="row between">
      <button type="submit" :disabled="busy">{{ register ? 'Registrarme' : 'Entrar' }}</button>
      <a
        href="#"
        class="muted"
        @click.prevent="go('login', { register: !register })"
      >{{ register ? 'Ya tengo cuenta' : 'Crear cuenta' }}</a>
    </div>
    <div v-if="error" class="msg bad">{{ error }}</div>
  </form>
</template>

<style scoped>
.login-card {
  max-width: 420px;
  margin: auto;
}
</style>
