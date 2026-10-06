// Valores del proyecto. Son los mismos que ya tiene la web en app.jsx (públicos, aceptado por el dueño).
// Nunca poner acá la contraseña de la base ni la key de Groq: esas viven en Netlify.

export const SITIO_URL = 'https://psi-estudio.netlify.app';
export const FUNCION_TRANSCRIBIR = `${SITIO_URL}/.netlify/functions/transcribir`;
export const SUPABASE_URL = 'https://eckgwyvbevlpnhjrsaxy.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVja2d3eXZiZXZscG5oanJzYXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzM1ODgsImV4cCI6MjEwNjIwOTU4OH0.MfgjL7yQPidqir2ybVEpcfeAsrioZGIIvgVv_bMyI7I';
export const APP_TOKEN = 'h5SUedldWPhWMN6Ja_kzirtUZXSTSo3Q1Zx8EZN9ktU';

// Duración de cada fragmento de grabación. 90 s a 128 kbps pesa ~1,4 MB (la función acepta hasta 5,5 MB).
export const SEGMENTO_SEGUNDOS = 90;
