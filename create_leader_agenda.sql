-- Migration: Agenda & Diário Semanal dos Líderes (Segurança RLS Reforçada)

CREATE TABLE IF NOT EXISTS public.leader_agenda (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    time TEXT,
    category TEXT NOT NULL DEFAULT 'GERAL',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    leader_id UUID NOT NULL,
    leader_name TEXT NOT NULL,
    leader_role TEXT,
    leader_avatar TEXT,
    team_ids TEXT[] DEFAULT '{}',
    team_names TEXT[] DEFAULT '{}',
    technician_ids TEXT[] DEFAULT '{}',
    technician_names TEXT[] DEFAULT '{}',
    company_id TEXT NOT NULL DEFAULT 'internal',
    comments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leader_agenda_date ON public.leader_agenda (date);
CREATE INDEX IF NOT EXISTS idx_leader_agenda_company_date ON public.leader_agenda (company_id, date);

ALTER TABLE public.leader_agenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura da agenda para usuários autenticados" ON public.leader_agenda;
CREATE POLICY "Permitir leitura da agenda para usuários autenticados"
    ON public.leader_agenda
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.company_id = 'internal' OR p.company_id = leader_agenda.company_id)
        )
    );

DROP POLICY IF EXISTS "Permitir inserção na agenda para líderes e chefes" ON public.leader_agenda;
CREATE POLICY "Permitir inserção na agenda para líderes e chefes"
    ON public.leader_agenda
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('CHEFE', 'LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER')
              AND (p.company_id = 'internal' OR p.company_id = leader_agenda.company_id)
        )
    );

DROP POLICY IF EXISTS "Permitir atualização na agenda para líderes e chefes" ON public.leader_agenda;
CREATE POLICY "Permitir atualização na agenda para líderes e chefes"
    ON public.leader_agenda
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('CHEFE', 'LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER')
              AND (p.company_id = 'internal' OR p.company_id = leader_agenda.company_id)
        )
    );

DROP POLICY IF EXISTS "Permitir exclusão na agenda para líderes e chefes" ON public.leader_agenda;
CREATE POLICY "Permitir exclusão na agenda para líderes e chefes"
    ON public.leader_agenda
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('CHEFE', 'LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER')
              AND (p.company_id = 'internal' OR p.company_id = leader_agenda.company_id)
        )
    );