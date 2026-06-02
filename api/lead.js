/**
 * DYS Solutions — Lead Notification API
 *
 * Envía un email a DYS cuando el chatbot captura un lead.
 * Usa Resend (resend.com) — gratuito hasta 100 emails/día.
 *
 * Variables de entorno necesarias en Vercel:
 *   RESEND_API_KEY  → tu API key de Resend
 *   LEAD_TO_EMAIL   → email donde quieres recibir los leads (ej: hola@dyssolutions.com)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, summary, conversation } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email required' });
  }

  /* Validación básica de email */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const apiKey   = process.env.RESEND_API_KEY;
  const toEmail  = process.env.LEAD_TO_EMAIL || 'hola@dyssolutions.com';

  if (!apiKey) {
    /* Si no hay Resend configurado, devolvemos ok silenciosamente
       para no romper la experiencia del usuario */
    console.warn('RESEND_API_KEY not set — lead not sent:', { name, email, summary });
    return res.status(200).json({ ok: true, sent: false });
  }

  const conversationText = Array.isArray(conversation)
    ? conversation.map(m => `${m.role === 'user' ? '👤 Usuario' : '🤖 DYS'}: ${m.content}`).join('\n\n')
    : 'Conversación no disponible';

  const emailBody = `
Nuevo lead desde el chatbot de DYS Solutions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 Nombre:  ${name}
📧 Email:   ${email}
📋 Resumen: ${summary || 'Sin resumen'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSACIÓN COMPLETA:

${conversationText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'Chatbot DYS <onboarding@resend.dev>',
        to:      [toEmail],
        subject: `🔔 Nuevo lead: ${name} — ${email}`,
        text:    emailBody,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return res.status(200).json({ ok: true, sent: false });
    }

    return res.status(200).json({ ok: true, sent: true });

  } catch (err) {
    console.error('Lead send error:', err);
    return res.status(200).json({ ok: true, sent: false });
  }
}
