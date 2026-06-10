-- ============================================================
-- MIGRAÇÃO: daily_reports e daily_activities - Filial Sul
-- ============================================================
-- PROBLEMA: As tabelas foram criadas com o schema legado
-- (setup_filial_sul.sql) que não corresponde ao código atual.
-- As tabelas estão VAZIAS, então é seguro recriá-las.
-- ============================================================
-- Execute este script no SQL Editor do Supabase:
-- https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- 1. Remover políticas RLS existentes (se houver)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'daily_activities'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON daily_activities', pol.policyname);
    END LOOP;

    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'daily_reports'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON daily_reports', pol.policyname);
    END LOOP;
END $$;

-- 2. Dropar tabelas na ordem correta (activities depende de reports)
DROP TABLE IF EXISTS daily_activities CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;

-- 3. Recriar daily_reports com schema correto
CREATE TABLE daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    team_id TEXT,
    technician_ids UUID[],
    car_plate TEXT,
    opec_id TEXT,
    route TEXT,
    notes TEXT,
    company_id TEXT NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recriar daily_activities com schema correto
CREATE TABLE daily_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES daily_reports(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    asset_codes TEXT[],
    technician_ids UUID[],
    lider_responsavel UUID REFERENCES auth.users(id),
    lider_name TEXT,
    car_plate TEXT,
    opec_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Índice para evitar relatórios duplicados por equipe/dia
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_team_date 
    ON daily_reports (date, team_id, company_id) 
    WHERE team_id IS NOT NULL;

-- 6. Habilitar RLS
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para daily_reports

-- SELECT: Líderes/Chefes veem tudo da empresa, técnicos veem o próprio ou da equipe
CREATE POLICY "daily_reports_select_v2" ON daily_reports
FOR SELECT USING (
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'LIDER', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER')
        AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('TECNICO', 'PARCEIRO_TECNICO')
        AND (
            user_id = auth.uid()
            OR team_id IN (SELECT id FROM teams WHERE technician_ids @> ARRAY[auth.uid()::text])
        )
    )
);

-- INSERT: Líderes e Chefes podem inserir
CREATE POLICY "daily_reports_insert" ON daily_reports
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
);

-- UPDATE: Chefes editam tudo. Líderes editam qualquer um da empresa SE for HOJE.
CREATE POLICY "daily_reports_update_v2" ON daily_reports
FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
        AND date = CURRENT_DATE
        AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
);

-- 8. Políticas RLS para daily_activities

-- SELECT: Herda visibilidade do relatório pai
CREATE POLICY "daily_activities_select" ON daily_activities
FOR SELECT USING (
    EXISTS (SELECT 1 FROM daily_reports WHERE id = report_id)
);

-- INSERT: Permite inserir se tiver acesso de edição ao relatório pai
CREATE POLICY "daily_activities_insert_v2" ON daily_activities
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
            OR
            (
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
                AND dr.date = CURRENT_DATE
                AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);

-- UPDATE: Permite atualizar quantidades
CREATE POLICY "daily_activities_update_v2" ON daily_activities
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
            OR
            (
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
                AND dr.date = CURRENT_DATE
                AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);

-- DELETE: Chefes ou Líderes no dia atual
CREATE POLICY "daily_activities_delete_v2" ON daily_activities
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
        AND EXISTS (
            SELECT 1 FROM daily_reports dr
            WHERE dr.id = report_id
            AND dr.date = CURRENT_DATE
            AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        )
    )
);

-- 9. Habilitar Realtime para daily_activities
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'daily_activities'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE daily_activities;
    END IF;
END $$;

-- 10. Verificação final
SELECT 'daily_reports columns:' AS info, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_reports' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'daily_activities columns:' AS info, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_activities' AND table_schema = 'public'
ORDER BY ordinal_position;
