/**
 * DYS Solutions — Chat API (Vercel Edge Function)
 *
 * La API key de DeepSeek NUNCA se expone al cliente.
 * Configúrala en Vercel Dashboard → Settings → Environment Variables
 * como: DEEPSEEK_API_KEY = sk-xxxxxxxxxxxxxx
 */

export const config = { runtime: 'edge' };

/* ── System prompt ─────────────────────────────────────────────────────────
 * Define la personalidad, límites y objetivos del asistente.
 * Edita este bloque para afinar el comportamiento sin tocar lógica.
 */
const SYSTEM_PROMPT = `Eres el asistente digital de DYS Solutions, una agencia digital premium especializada en:

1. DISEÑO WEB — Interfaces de alto rendimiento orientadas a la conversión con estética premium.
2. PRODUCCIÓN DE VÍDEO — Contenido audiovisual de alta fidelidad: reels, videoclips, documentales.
3. EDICIÓN AVANZADA — Montaje rítmico, color grading cinemático, tratamiento de sonido profesional.
4. RECONSTRUCCIÓN IA — Escalado inteligente, expansión de encuadre, restauración de archivos y generación de assets mediante IA avanzada.

FORMA DE HABLAR:
- Conciso y directo. Máximo 3-4 frases por respuesta.
- Tono consultor senior: seguro, experto, sin jerga innecesaria.
- Español neutro. Si el usuario escribe en otro idioma, adapta al suyo.
- Persuasivo pero sin presión. Generas deseo real, no urgencia falsa.

LO QUE HACES:
- Escuchas al usuario para entender su necesidad real.
- Conectas esa necesidad con el servicio de DYS que lo resuelve mejor.
- Das un ejemplo concreto o dato que demuestre expertise cuando sea útil.
- Terminas con una pregunta o micro-CTA natural cuando encaje.

LO QUE NO HACES:
- No inventas precios. Si preguntan, explicas que cada proyecto es diferente y ofreces consulta gratuita.
- No hablas de temas sin relación con marketing digital, producción audiovisual o los servicios de DYS.
- Si te desvían a un tema irrelevante, respondes brevemente y reconduces con amabilidad.
- No eres un chatbot genérico. Eres el experto de DYS Solutions.
- No hagas listas con bullets en cada respuesta. Conversa de forma natural.

PORTFOLIO REAL: ProCar Sales (automoción), Madu Box (fitness y boxeo), Jardines Raúl Aguiló (jardinería en Mallorca).
CONTACTO PARA PRESUPUESTOS: hola@dyssolutions.com`;

/* ── Guardrails ────────────────────────────────────────────────────────────
 * Límites técnicos aplicados en servidor para evitar abuso.
 */
const MAX_MESSAGES    = 20;   /* conversaciones largas fuera de rango */
const MAX_MSG_LENGTH  = 600;  /* caracteres por mensaje del usuario  */
const MAX_TOKENS_OUT  = 350;  /* respuestas concisas                  */

export default async function handler(request) {

  /* ── Método ── */
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  /* ── Body ── */
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages } = body;

  /* ── Validación ── */
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages array required', { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return new Response('Conversation too long', { status: 429 });
  }

  /* Sanitización: solo roles válidos, longitud máxima */
  const clean = messages
    .filter(m => ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
    .map(m => ({
      role   : m.role,
      content: m.content.slice(0, MAX_MSG_LENGTH),
    }));

  if (clean.length === 0) {
    return new Response('No valid messages', { status: 400 });
  }

  /* ── Llamada a DeepSeek ── */
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response('Service not configured', { status: 503 });
  }

  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model     : 'deepseek-v4-flash',
        messages  : [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
        stream    : true,
        max_tokens: MAX_TOKENS_OUT,
        temperature: 0.7,
      }),
    });
  } catch {
    return new Response('Upstream error', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response('API error', { status: upstream.status });
  }

  /* ── Proxy del stream directamente al cliente ── */
  return new Response(upstream.body, {
    headers: {
      'Content-Type' : 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
