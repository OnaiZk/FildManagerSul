import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
const rawSupabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key';

// Proteção contra vazamento acidental de chave service_role / secret no frontend
if (
    rawSupabaseKey.startsWith('sb_secret_') ||
    rawSupabaseKey.includes('service_role')
) {
    throw new Error(
        '[SECURITY] Chave privada (service_role / sb_secret) detectada no frontend. Use exclusivamente a chave pública (anon / publishable).'
    );
}

if (import.meta.env.PROD && !rawSupabaseUrl.startsWith('https://')) {
    throw new Error('[SECURITY] VITE_SUPABASE_URL deve utilizar HTTPS em produção.');
}

export const supabase = createClient(rawSupabaseUrl, rawSupabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Permite tokens de recuperação e convite na URL
    },
    realtime: {
        params: {
            eventsPerSecond: 2, // Limita frequência de eventos realtime
        },
    },
});
