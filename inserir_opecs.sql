-- =====================================================
-- INSERIR OPECs (CELULARES) 1 A 14
-- Execute TUDO de uma vez no SQL Editor do Supabase
-- =====================================================

-- 1. Garantir colunas extras existem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opec_devices' AND column_name = 'serial_number') THEN
        ALTER TABLE opec_devices ADD COLUMN serial_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opec_devices' AND column_name = 'capacity') THEN
        ALTER TABLE opec_devices ADD COLUMN capacity TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opec_devices' AND column_name = 'imei_1') THEN
        ALTER TABLE opec_devices ADD COLUMN imei_1 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opec_devices' AND column_name = 'imei_2') THEN
        ALTER TABLE opec_devices ADD COLUMN imei_2 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opec_devices' AND column_name = 'observations') THEN
        ALTER TABLE opec_devices ADD COLUMN observations TEXT;
    END IF;
END $$;

-- 2. Desabilitar RLS
ALTER TABLE opec_devices DISABLE ROW LEVEL SECURITY;

-- 3. Limpar OPECs antigos com esses códigos
DELETE FROM opec_devices WHERE asset_code IN (
  'OPEC-01','OPEC-02','OPEC-03','OPEC-04','OPEC-05',
  'OPEC-06','OPEC-07','OPEC-08','OPEC-09','OPEC-10',
  'OPEC-11','OPEC-12','OPEC-13','OPEC-14'
);

-- 4. Inserir os 14 OPECs
INSERT INTO opec_devices (asset_code, phone_number, brand, model, status, company_id) VALUES
('OPEC-01', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-02', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-03', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-04', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-05', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-06', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-07', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-08', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-09', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-10', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-11', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-12', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-13', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal'),
('OPEC-14', '-', 'Samsung', 'Celular Corporativo', 'ACTIVE', 'internal');

-- 5. Reativar RLS com políticas permissivas
ALTER TABLE opec_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_opec" ON opec_devices;
DROP POLICY IF EXISTS "allow_insert_opec" ON opec_devices;
DROP POLICY IF EXISTS "allow_update_opec" ON opec_devices;
DROP POLICY IF EXISTS "allow_delete_opec" ON opec_devices;

CREATE POLICY "allow_select_opec" ON opec_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_opec" ON opec_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update_opec" ON opec_devices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_delete_opec" ON opec_devices FOR DELETE TO authenticated USING (true);

-- 6. Fazer o mesmo para opec_management (atribuições)
ALTER TABLE opec_management ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_opec_mgmt" ON opec_management;
DROP POLICY IF EXISTS "allow_insert_opec_mgmt" ON opec_management;
DROP POLICY IF EXISTS "allow_update_opec_mgmt" ON opec_management;
DROP POLICY IF EXISTS "allow_delete_opec_mgmt" ON opec_management;

CREATE POLICY "allow_select_opec_mgmt" ON opec_management FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert_opec_mgmt" ON opec_management FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update_opec_mgmt" ON opec_management FOR UPDATE TO authenticated USING (true);
CREATE POLICY "allow_delete_opec_mgmt" ON opec_management FOR DELETE TO authenticated USING (true);

-- 7. Verificar: deve mostrar 14
SELECT count(*) as total_opecs FROM opec_devices;
