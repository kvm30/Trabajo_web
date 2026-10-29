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
const newPassword = ref('');
const confirmPassword = ref('');
const error = ref('');
const message = ref('');
const busy = ref(false);
const resetComplete = ref(false);
const register = props.view.register;
const recovery = props.view.recovery;
const resetToken = props.view.resetToken;

async function submit() {
  error.value = '';
  if (register) {
    if (name.value.trim().length < 2) {
      error.value = 'El nombre debe tener al menos 2 caracteres';
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(password.value)) {
      error.value = 'La contraseña debe tener al menos 8 caracteres, una letra y un número';
      return;
    }
  }
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

async function requestPasswordReset() {
  error.value = '';
  message.value = '';
  busy.value = true;
  try {
    await props.api('/auth/forgot-password', 'POST', { email: email.value });
    message.value = 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.';
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

async function resetPassword() {
  error.value = '';
  message.value = '';
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden';
    return;
  }
  if (!/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(newPassword.value)) {
    error.value = 'La contraseña debe tener al menos 8 caracteres, una letra y un número';
    return;
  }

  busy.value = true;
  try {
    await props.api('/auth/reset-password', 'POST', {
      token: resetToken,
      password: newPassword.value,
    });
    resetComplete.value = true;
    message.value = 'Tu contraseña se cambió correctamente. Ya puedes iniciar sesión.';
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form v-if="recovery" class="card login-card" @submit.prevent="requestPasswordReset">
    <h2>Recuperar contraseña</h2>
    <p class="muted">Escribe el correo asociado a tu cuenta y te enviaremos un enlace para cambiarla.</p>
    <label for="email">Email</label>
    <input id="email" v-model="email" type="email" autocomplete="email" required>
    <div class="row between">
      <button type="submit" :disabled="busy">Enviar enlace</button>
      <a href="#" class="muted" @click.prevent="go('login')">Volver a ingresar</a>
    </div>
    <div v-if="message" class="msg ok" role="status">{{ message }}</div>
    <div v-if="error" class="msg bad" role="alert">{{ error }}</div>
  </form>

  <form v-else-if="resetToken && !resetComplete" class="card login-card" @submit.prevent="resetPassword">
    <h2>Cambiar contraseña</h2>
    <label for="new-password">Nueva contraseña</label>
    <input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*\d).{8,}" title="Mínimo 8 caracteres, incluyendo una letra y un número" required>
    <label for="confirm-password">Confirmar contraseña</label>
    <input id="confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
    <div class="row between">
      <button type="submit" :disabled="busy">Guardar contraseña</button>
      <a href="#" class="muted" @click.prevent="go('login')">Volver a ingresar</a>
    </div>
    <div v-if="error" class="msg bad" role="alert">{{ error }}</div>
  </form>

  <section v-else-if="resetComplete" class="card login-card">
    <h2>Contraseña actualizada</h2>
    <div v-if="message" class="msg ok" role="status">{{ message }}</div>
    <a href="#" @click.prevent="go('login')">Ir a ingresar</a>
  </section>

  <form v-else class="card login-card" @submit.prevent="submit">
    <h2>{{ register ? 'Crear cuenta' : 'Ingresar' }}</h2>
    <label v-if="register" for="name">Nombre</label>
    <input v-if="register" id="name" v-model="name" autocomplete="name" minlength="2" maxlength="100" required>
    <label for="email">Email</label>
    <input id="email" v-model="email" type="email" autocomplete="email" maxlength="150" required>
    <label for="password">Contraseña</label>
    <input
      id="password"
      v-model="password"
      type="password"
      :autocomplete="register ? 'new-password' : 'current-password'"
      :pattern="register ? '(?=.*[A-Za-z])(?=.*\\d).{8,}' : undefined"
      :title="register ? 'Mínimo 8 caracteres, incluyendo una letra y un número' : undefined"
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
    <a
      v-if="!register"
      href="#"
      class="muted recovery-link"
      @click.prevent="go('forgot-password')"
    >¿Olvidaste tu contraseña?</a>
    <div v-if="error" class="msg bad">{{ error }}</div>
  </form>
</template>

<style scoped>
.login-card {
  max-width: 420px;
  margin: auto;
}

.recovery-link {
  display: inline-block;
  margin-top: 14px;
}
</style>
