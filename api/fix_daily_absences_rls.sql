-- ============================================================
-- FIX: RLS Policies para daily_absences
-- ============================================================
-- PROBLEMA: A tabela tem RLS habilitado mas não possui políticas
-- de INSERT/UPDATE/DELETE, bloqueando qualquer operação.
-- ============================================================

-- 1. Garantir que RLS está habilitado
ALTER TABLE daily_absences ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Absences viewable by company" ON daily_absences;
DROP POLICY IF EXISTS "Absences insertable by leaders and chiefs" ON daily_absences;
DROP POLICY IF EXISTS "daily_absences_select" ON daily_absences;
DROP POLICY IF EXISTS "daily_absences_insert" ON daily_absences;
DROP POLICY IF EXISTS "daily_absences_update" ON daily_absences;
DROP POLICY IF EXISTS "daily_absences_delete" ON daily_absences;

-- 3. SELECT: Todos da mesma empresa podem ver
CREATE POLICY "daily_absences_select" ON daily_absences
FOR SELECT USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('CHEFE', 'PARCEIRO_CHEFE')
);

-- 4. INSERT: Líderes e Chefes podem registrar faltas
CREATE POLICY "daily_absences_insert" ON daily_absences
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
);

-- 5. UPDATE: Líderes e Chefes podem editar
CREATE POLICY "daily_absences_update" ON daily_absences
FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
    AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- 6. DELETE: Líderes e Chefes podem remover
CREATE POLICY "daily_absences_delete" ON daily_absences
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
    AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
);

-- 7. Verificação
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'daily_absences';
