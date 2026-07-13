// ─────────────────────────────────────────────────────────────────────────────
// Proxy de IA para Sinapsis (Cloudflare Worker)
// El navegador llama aquí SIN clave; el Worker agrega la clave de DeepSeek
// (secreto DEEPSEEK_API_KEY, invisible para el público) y reenvía.
//
// Protecciones:
//  - Solo POST con JSON y solo desde los orígenes permitidos (CORS estricto).
//  - Solo modelos deepseek-* y tope de max_tokens (nadie usa tu saldo para otra cosa).
//  - Límite de peticiones por IP por minuto (mejor esfuerzo, en memoria).
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
    'https://fonseca707.github.io',
    'http://localhost:8642',
    'http://127.0.0.1:8642'
];
const MAX_TOKENS_CAP = 1500;
const RATE_LIMIT_PER_MIN = 20;

const hits = new Map(); // ip -> {count, windowStart} (por instancia; mejor esfuerzo)

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function rateLimited(ip) {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.windowStart > 60_000) {
        hits.set(ip, { count: 1, windowStart: now });
        if (hits.size > 5000) hits.clear(); // no crecer sin límite
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT_PER_MIN;
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const allowed = ALLOWED_ORIGINS.includes(origin);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(origin) : {} });
        }
        if (!allowed) return new Response('Origen no permitido', { status: 403 });
        if (request.method !== 'POST') return new Response('Solo POST', { status: 405, headers: corsHeaders(origin) });

        const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
        if (rateLimited(ip)) {
            return new Response(JSON.stringify({ error: 'Demasiadas peticiones, espera un minuto.' }),
                { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
        }

        let body;
        try { body = await request.json(); } catch {
            return new Response('JSON inválido', { status: 400, headers: corsHeaders(origin) });
        }

        // Solo modelos DeepSeek y tope de tokens: nadie reutiliza el proxy para otra cosa
        if (!String(body.model || '').startsWith('deepseek')) body.model = 'deepseek-v4-flash';
        body.max_tokens = Math.min(Number(body.max_tokens) || 600, MAX_TOKENS_CAP);
        body.stream = false;

        const upstream = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(body)
        });

        return new Response(upstream.body, {
            status: upstream.status,
            headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
        });
    }
};
