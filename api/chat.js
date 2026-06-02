/**
 * DYS Solutions — Chat API (Vercel Serverless Function, Node.js)
 *
 * API key configurada en Vercel Dashboard → Settings → Environment Variables
 * como: DEEPSEEK_API_KEY = sk-xxxxxxxxxxxxxx
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

const MAX_MESSAGES   = 20;
const MAX_MSG_LENGTH = 600;
const MAX_TOKENS_OUT = 350;

export default async function handler(req, res) {
  /* ── CORS mínimo ── */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  /* ── Validación ── */
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(429).json({ error: 'Conversation too long' });
  }

  const clean = messages
    .filter(m => ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MSG_LENGTH) }));

  if (clean.length === 0) {
    return res.status(400).json({ error: 'No valid messages' });
  }

  /* ── API key ── */
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Service not configured' });

  /* ── Llamada a DeepSeek ── */
  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'deepseek-v4-flash',
        messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
        stream:      false,
        max_tokens:  MAX_TOKENS_OUT,
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('DeepSeek error:', err);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data    = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';

    return res.status(200).json({ content });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Service unavailable' });
  }
}
