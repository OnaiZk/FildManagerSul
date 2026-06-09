-- ============================================================
-- TEMPLATE: Import de OPECs para Filial Sul
-- ============================================================
-- Este arquivo serve como template para importar novos
-- colaboradores e dispositivos OPEC da Filial Sul.
-- Substitua os dados de exemplo pelos dados reais.
-- ============================================================

-- 1. LIMPAR DADOS EXISTENTES (se necessário)
-- DELETE FROM opec_management WHERE company_id = 'internal';
-- DELETE FROM opec_devices WHERE company_id = 'internal';

-- 2. INSERIR NOVOS DISPOSITIVOS OPEC
-- Descomente e preencha com os dados reais:
/*
INSERT INTO opec_devices (asset_code, phone_number, brand, model, company_id) VALUES
('Opec S001', '(XX) XXXXX-XXXX', 'MOTOROLA', 'MotoG35', 'internal'),
('Opec S002', '(XX) XXXXX-XXXX', 'MOTOROLA', 'MotoG35', 'internal')
ON CONFLICT (asset_code) DO UPDATE SET 
    phone_number = EXCLUDED.phone_number,
    company_id = EXCLUDED.company_id;
*/

-- 3. INSERIR COLABORADORES (employee_invites)
-- Descomente e preencha com os dados reais:
/*
-- Garantir unique constraint no email
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employee_invites_email_key'
    ) THEN
        ALTER TABLE employee_invites ADD CONSTRAINT employee_invites_email_key UNIQUE (email);
    END IF;
END $$;

INSERT INTO employee_invites (name, email, role, company_id, company_name, shift) VALUES
('NOME DO COLABORADOR 1', 'email1@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul', 'DIURNO'),
('NOME DO COLABORADOR 2', 'email2@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul', 'DIURNO'),
('NOME DO LIDER 1', 'lider1@eletromidia.com.br', 'LIDER', 'internal', 'Eletromidia Sul', 'DIURNO')
ON CONFLICT (email) DO NOTHING;
*/

-- 4. VINCULAR OPECs AOS COLABORADORES
-- Descomente e preencha com os dados reais:
/*
INSERT INTO opec_management (opec_name, employee_id, company_id)
SELECT sub.opec, u.id, 'internal'
FROM (
    SELECT 'Opec S001' as opec, 'NOME DO COLABORADOR 1' as name UNION ALL
    SELECT 'Opec S001', 'NOME DO COLABORADOR 2' UNION ALL
    SELECT 'Opec S002', 'NOME DO LIDER 1'
) sub
JOIN (
    SELECT id, name FROM profiles
    UNION ALL
    SELECT id, name FROM employee_invites
) u ON u.name = sub.name;
*/
