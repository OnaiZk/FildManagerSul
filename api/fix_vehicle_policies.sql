-- ====================================================================
-- FIX COMPLETO: Políticas de segurança para tabela VEHICLES
-- Execute este script no SQL Editor do Supabase
-- ====================================================================

-- 1. Primeiro, vamos listar as políticas existentes para debug
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'vehicles';

-- 2. Remover TODAS as políticas existentes da tabela vehicles
DROP POLICY IF EXISTS "Vehicles are viewable by company members" ON vehicles;
DROP POLICY IF EXISTS "Internal members can manage fleet" ON vehicles;
DROP POLICY IF EXISTS "Company members can manage their fleet" ON vehicles;
DROP POLICY IF EXISTS "Everyone can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Everyone can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Everyone can delete vehicles" ON vehicles;

-- 3. Garantir que RLS está habilitado
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- 4. Política de SELECT: membros da empresa podem ver seus veículos
CREATE POLICY "vehicles_select_policy" ON vehicles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.company_id = vehicles.company_id OR profiles.company_id = 'internal')
  )
);

-- 5. Política de INSERT: qualquer usuário autenticado pode inserir veículos
CREATE POLICY "vehicles_insert_policy" ON vehicles FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 6. Política de UPDATE: membros da empresa podem atualizar seus veículos
CREATE POLICY "vehicles_update_policy" ON vehicles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.company_id = vehicles.company_id OR profiles.company_id = 'internal')
  )
);

-- 7. Política de DELETE: membros da empresa podem deletar seus veículos
CREATE POLICY "vehicles_delete_policy" ON vehicles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.company_id = vehicles.company_id OR profiles.company_id = 'internal')
  )
);

-- 8. Verificar que as novas políticas foram criadas
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'vehicles';
