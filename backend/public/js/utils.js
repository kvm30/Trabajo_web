export const $ = (selector) => document.querySelector(selector);

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

export const fmt = (date) => new Date(date).toLocaleString();

export function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.className = 'show';
  setTimeout(() => (element.className = ''), 2500);
}
