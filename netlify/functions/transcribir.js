// Función de Netlify: transcribe un fragmento de audio con Groq.
// - La key de Groq vive en la variable GROQ_API_KEY de Netlify (nunca en el navegador).
// - Solo responde si el pedido trae el header x-app-token igual a PSI_API_TOKEN (variable de Netlify).
// - Netlify acepta cuerpos de hasta ~6 MB, por eso la web manda fragmentos chicos.

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_BYTES = 5.5 * 1024 * 1024;

function respuesta(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  };
}

function claveValida(recibida, esperada) {
  if (!recibida || !esperada || esperada.length < 24) return false;
  if (recibida.length !== esperada.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperada.length; i++) {
    diferencia |= recibida.charCodeAt(i) ^ esperada.charCodeAt(i);
  }
  return diferencia === 0;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respuesta(405, { error: 'Método no permitido' });

  const claveEsperada = process.env.PSI_API_TOKEN || '';
  const recibida = (event.headers && (event.headers['x-app-token'] || event.headers['X-App-Token'])) || '';
  if (!claveValida(recibida, claveEsperada)) return respuesta(401, { error: 'Clave inválida o ausente' });

  const groqKey = process.env.GROQ_API_KEY || '';
  if (!groqKey) return respuesta(500, { error: 'Falta GROQ_API_KEY en la configuración de Netlify' });

  const cuerpo = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
  if (cuerpo.length === 0) return respuesta(400, { error: 'Audio vacío' });
  if (cuerpo.length > MAX_BYTES) return respuesta(413, { error: 'Fragmento demasiado grande' });

  const tipo = (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || 'audio/wav';
  const form = new FormData();
  form.append('file', new Blob([cuerpo], { type: tipo }), 'fragmento.wav');
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'verbose_json');
  form.append('language', 'es');
  form.append('temperature', '0.0');

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return respuesta(res.status, { error: (data.error && data.error.message) || `Groq respondió ${res.status}` });
    }
    return respuesta(200, {
      text: data.text || '',
      duration: data.duration || 0,
      segments: (data.segments || []).map((s) => ({ start: s.start, end: s.end, text: s.text, words: s.words || [] })),
    });
  } catch (err) {
    return respuesta(502, { error: 'No se pudo contactar a Groq' });
  }
};
