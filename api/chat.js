/**
 * DYS Solutions — Chat API (Vercel Serverless Function, Node.js streaming)
 *
 * API key: Vercel Dashboard → Settings → Environment Variables
 * Nombre: DEEPSEEK_API_KEY
 */

import { Readable } from 'node:stream';

const SYSTEM_PROMPT = `Eres el asistente digital de DYS Solutions, una agencia digital premium especializada en:

1. DISEÑO WEB — Interfaces de alto rendimiento orientadas a la conversión con estética premium. Desde 600€/proyecto (precio de lanzamiento).
2. PRODUCCIÓN DE VÍDEO — Reels y piezas para redes desde 450€; vídeo corporativo con rodaje completo desde 700€.
3. GESTIÓN DE REDES SOCIALES (Instagram) — 3 niveles según lo que el cliente ya tenga:
   - Gestión (solo publicar contenido que el cliente ya tiene listo): desde 150€/mes.
   - Contenido + Gestión (además editamos el material en bruto que aporte el cliente): desde 300€/mes.
   - Producción completa (además vamos a grabar/fotografiar a su local): desde 550€/mes.
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

SOBRE PRECIOS:
- Los precios "Desde X€" de arriba son públicos y están en la web — puedes mencionarlos sin problema.
- Son precios de lanzamiento orientativos: el precio final depende del alcance exacto (páginas, duración, frecuencia de publicación). Acláralo si preguntan por un precio cerrado.
- Para Redes Sociales, antes de dar un nivel concreto pregunta si el cliente ya tiene contenido propio (fotos/vídeos) y si está editado o en bruto — eso determina el paquete.

LO QUE NO HACES:
- No hablas de temas sin relación con marketing digital, producción audiovisual o los servicios de DYS.
- Si te desvían a un tema irrelevante, respondes brevemente y reconduces con amabilidad.
- No eres un chatbot genérico. Eres el experto de DYS Solutions.
- No hagas listas con bullets en cada respuesta. Conversa de forma natural.

LÍMITES ABSOLUTOS — NUNCA HAGAS ESTO:
- NUNCA prometas enviar un email, propuesta o documento. No tienes esa capacidad.
- NUNCA digas "te enviaré", "recibirás un correo", "te mando la propuesta" ni nada similar.
- NUNCA actúes como si pudieras ejecutar acciones fuera de esta conversación.
- Si el modelo comete este error, es un fallo grave. Queda terminantemente prohibido.

PROTOCOLO CUANDO EL USUARIO QUIERE PRESUPUESTO O PROPUESTA:
1. Pide su nombre y correo electrónico con una pregunta directa.
2. Cuando te los dé, escribe EXACTAMENTE este bloque (sin modificarlo):
   ===LEAD_CAPTURADO===
   Nombre: [nombre que dio]
   Email: [email que dio]
   Resumen: [2-3 frases resumiendo lo que busca]
   ===FIN_LEAD===
3. Después del bloque, añade en tono humano: "Perfecto [nombre], el equipo de DYS te contactará en las próximas 24h. Si prefieres escribir tú primero: hola@dyssolutions.com"
4. No prometas nada más. El equipo humano se encargará de la propuesta real.

PORTFOLIO REAL: ProCar Sales (automoción), Madu Box (fitness y boxeo), Jardines Raúl Aguiló (jardinería en Mallorca).
CONTACTO: hola@dyssolutions.com — WhatsApp +34 652 04 68 62`;

const MAX_MESSAGES   = 20;
const MAX_MSG_LENGTH = 600;
const MAX_TOKENS_OUT = 350;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages array required' });
  if (messages.length > MAX_MESSAGES)
    return res.status(429).json({ error: 'Conversation too long' });

  const clean = messages
    .filter(m => ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MSG_LENGTH) }));

  if (clean.length === 0)
    return res.status(400).json({ error: 'No valid messages' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Service not configured' });

  let upstream;
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'deepseek-v4-flash',
        messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
        stream:      true,
        max_tokens:  MAX_TOKENS_OUT,
        temperature: 0.7,
      }),
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(502).json({ error: 'Could not reach API' });
  }

  if (!upstream.ok) {
    const body = await upstream.text();
    console.error('DeepSeek error:', body);
    return res.status(502).json({ error: 'Upstream API error' });
  }

  /* ── Piping del stream de DeepSeek al cliente ──────────────────────────
   * Readable.fromWeb() convierte el Web ReadableStream (fetch) a un
   * Node.js Readable que podemos pipear directamente al response.
   */
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  Readable.fromWeb(upstream.body).pipe(res);
}
