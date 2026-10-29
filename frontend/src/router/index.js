import { createRouter, createWebHistory } from 'vue-router';
import AdminView from '../views/AdminView.vue';
import DetailView from '../views/DetailView.vue';
import ElectionsView from '../views/ElectionsView.vue';
import HistoryView from '../views/HistoryView.vue';
import LoginView from '../views/LoginView.vue';
import ProfileView from '../views/ProfileView.vue';
import VerifyView from '../views/VerifyView.vue';

const routes = [
  { path: '/', name: 'elections', component: ElectionsView },
  { path: '/elections/:id', name: 'detail', component: DetailView },
  { path: '/history', name: 'history', component: HistoryView },
  { path: '/profile', name: 'profile', component: ProfileView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: LoginView },
  { path: '/forgot-password', name: 'forgot-password', component: LoginView },
  { path: '/reset-password', name: 'reset-password', component: LoginView },
  { path: '/verify', name: 'verify', component: VerifyView },
  { path: '/admin', name: 'admin', component: AdminView },
  { path: '/:pathMatch(.*)*', redirect: { name: 'elections' } },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
