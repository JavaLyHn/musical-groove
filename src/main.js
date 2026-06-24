// Entry point. Tasks 6+ replace the body with the full scene wiring.
const canvas = document.getElementById('app');
const ctx = canvas.getContext('webgl2');
console.log('[声音星球] boot', ctx ? 'webgl2 ok' : 'no webgl2');
