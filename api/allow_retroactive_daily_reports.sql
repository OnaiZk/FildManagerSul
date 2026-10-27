-- =====================================================
-- PERMITIR LANÇAMENTO RETROATIVO DE RELATÓRIOS DIÁRIOS
-- Permite que supervisores e líderes preencham e editem
-- relatórios da sua empresa mesmo de datas passadas (retroativo).
-- =====================================================

-- 1. Políticas de UPDATE em daily_reports
DROP POLICY IF EXISTS "daily_reports_update_v2" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_update_v3" ON daily_reports;

CREATE POLICY "daily_reports_update_v3" ON daily_reports
FOR UPDATE USING (
    -- Chefes editam qualquer relatório
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    OR
    -- Líderes/Supervisores editam qualquer relatório da sua empresa (incluindo datas passadas)
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
        AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
);

-- 2. Políticas de INSERT em daily_activities
DROP POLICY IF EXISTS "daily_activities_insert_v2" ON daily_activities;
DROP POLICY IF EXISTS "daily_activities_insert_v3" ON daily_activities;

CREATE POLICY "daily_activities_insert_v3" ON daily_activities
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
            OR
            (
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
                AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);

-- 3. Políticas de UPDATE em daily_activities
DROP POLICY IF EXISTS "daily_activities_update_v2" ON daily_activities;
DROP POLICY IF EXISTS "daily_activities_update_v3" ON daily_activities;

CREATE POLICY "daily_activities_update_v3" ON daily_activities
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM daily_reports dr
        WHERE dr.id = report_id
        AND (
            (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
            OR
            (
                (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
                AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
            )
        )
    )
);

-- 4. Políticas de DELETE em daily_activities
DROP POLICY IF EXISTS "daily_activities_delete_v2" ON daily_activities;
DROP POLICY IF EXISTS "daily_activities_delete_v3" ON daily_activities;

CREATE POLICY "daily_activities_delete_v3" ON daily_activities
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
    OR
    (
        (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'PARCEIRO_LIDER')
        AND EXISTS (
            SELECT 1 FROM daily_reports dr
            WHERE dr.id = report_id
            AND dr.company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
        )
    )
);
