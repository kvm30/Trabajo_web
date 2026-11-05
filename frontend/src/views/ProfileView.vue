<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  api: { type: Function, required: true },
  session: { type: Object, required: true },
  setSession: { type: Function, required: true },
  toast: { type: Function, required: true },
  go: { type: Function, required: true },
});

const name = ref('');
const email = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const profileError = ref('');
const passwordError = ref('');
const profileBusy = ref(false);
const passwordBusy = ref(false);

function validPassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

async function loadProfile() {
  try {
    const user = await props.api('/users/me');
    name.value = user.name || '';
    email.value = user.email || '';
  } catch (err) {
    profileError.value = err.message;
  }
}

async function saveProfile() {
  profileError.value = '';
  if (name.value.trim().length < 2 || name.value.trim().length > 100) {
    profileError.value = 'El nombre debe tener entre 2 y 100 caracteres';
    return;
  }
  profileBusy.value = true;
  try {
    const data = await props.api('/users/me', 'PUT', { name: name.value, email: email.value });
    props.setSession({ token: data.token, user: data.user });
    props.toast('Perfil actualizado');
  } catch (err) {
    profileError.value = err.message;
  } finally {
    profileBusy.value = false;
  }
}

async function savePassword() {
  passwordError.value = '';
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = 'Completa todos los campos de contraseña';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Las contraseñas nuevas no coinciden';
    return;
  }
  if (!validPassword(newPassword.value)) {
    passwordError.value = 'Usa al menos 8 caracteres, una letra y un número';
    return;
  }
  passwordBusy.value = true;
  try {
    await props.api('/users/me/password', 'PUT', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value,
    });
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    props.toast('Contraseña actualizada');
  } catch (err) {
    passwordError.value = err.message;
  } finally {
    passwordBusy.value = false;
  }
}

onMounted(() => {
  if (!props.session) props.go('login');
  else loadProfile();
});
</script>

<template>
  <div v-if="session">
    <button class="ghost" @click="go('elections')">← Volver</button>
    <h2>Mi perfil</h2>

    <form class="card profile-card" @submit.prevent="saveProfile">
      <h3>Datos personales</h3>
      <label for="profile-name">Nombre</label>
      <input id="profile-name" v-model="name" autocomplete="name" minlength="2" maxlength="100" required>
      <label for="profile-email">Email</label>
      <input id="profile-email" v-model="email" type="email" autocomplete="email" maxlength="150" required>
      <button type="submit" :disabled="profileBusy">{{ profileBusy ? 'Guardando…' : 'Guardar datos' }}</button>
      <div v-if="profileError" class="msg bad" role="alert">{{ profileError }}</div>
    </form>

    <form class="card profile-card" @submit.prevent="savePassword">
      <h3>Cambiar contraseña</h3>
      <label for="current-password">Contraseña actual</label>
      <input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password" required>
      <label for="new-password">Nueva contraseña</label>
      <input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required>
      <label for="confirm-password">Confirmar nueva contraseña</label>
      <input id="confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
      <button type="submit" :disabled="passwordBusy">{{ passwordBusy ? 'Guardando…' : 'Cambiar contraseña' }}</button>
      <div v-if="passwordError" class="msg bad" role="alert">{{ passwordError }}</div>
    </form>
  </div>
</template>

<style scoped>
.profile-card {
  max-width: 620px;
  margin-bottom: 16px;
}
</style>
