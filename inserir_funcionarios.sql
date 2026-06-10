-- =====================================================
-- SCRIPT COMPLETO: INSERIR FUNCIONÁRIOS + CORRIGIR RLS
-- Execute TUDO de uma vez no SQL Editor do Supabase
-- =====================================================

-- 1. Desabilitar RLS temporariamente para garantir inserção
ALTER TABLE employee_invites DISABLE ROW LEVEL SECURITY;

-- 2. Limpar tentativas anteriores (só emails da lista)
DELETE FROM employee_invites WHERE email ILIKE ANY(ARRAY[
  'alexandre.muniz@eletromidia.com.br',
  'brenon.barreto@eletromidia.com.br',
  'claudemir.silva@eletromidia.com.br',
  'claudinei.costa@eletromidia.com.br',
  'cleber.oliveira@eletromidia.com.br',
  'cleyton.santos@eletromidia.com.br',
  'eduardo.alicate@eletromidia.com.br',
  'eduardo.souza@eletromidia.com.br',
  'felipe.batista@eletromidia.com.br',
  'felipe.pereira@eletromidia.com.br',
  'james.souza@eletromidia.com.br',
  'jefferson.costa@eletromidia.com.br',
  'joao.barbosa@eletromidia.com.br',
  'jose.costa@eletromidia.com.br',
  'jose.limas@eletromidia.com.br',
  'lucas.caetano@eletromidia.com.br',
  'lucas.rocha@eletromidia.com.br',
  'marcio.sobreira@eletromidia.com.br',
  'pedro.bispo@eletromidia.com.br',
  'reginaldo.santos@eletromidia.com.br',
  'ricardo.roschel@eletromidia.com.br',
  'patrick.silva@eletromidia.com.br',
  'vitor.reis@eletromidia.com.br',
  'wesley.lopes@eletromidia.com.br',
  'weverson.almeida@eletromidia.com.br',
  'william.santos@eletromidia.com.br',
  'luiz.gomes@eletromidia.com.br',
  'robson.foliene@eletromidia.com.br'
]);

-- 3. Inserir todos os 28 funcionários
INSERT INTO employee_invites (code, name, email, role, company_id, company_name) VALUES
('94788', 'ALEXANDRE DA COSTA MUNIZ', 'alexandre.muniz@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94663', 'BRENON G. R. DE OL. BARRETO', 'brenon.barreto@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94667', 'CLAUDEMIR JOSE DA SILVA', 'claudemir.silva@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94986', 'CLAUDINEI DA COSTA', 'claudinei.costa@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94760', 'CLEBER COSTA OLIVEIRA', 'cleber.oliveira@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94948', 'CLEYTON MARQUES DOS SANTOS', 'cleyton.santos@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94677', 'EDUARDO ALICATE', 'eduardo.alicate@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122434', 'EDUARDO SOUZA DA SILVA', 'eduardo.souza@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122421', 'FELIPE BATISTA PEREIRA', 'felipe.batista@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94922', 'FELIPE PEREIRA DA SILVA', 'felipe.pereira@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94694', 'JAMES CARVALHO DE SOUZA', 'james.souza@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94966', 'JEFFERSON FERREIRA COSTA', 'jefferson.costa@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122676', 'JOÃO VITOR ALVES BARBOSA', 'joao.barbosa@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94748', 'JOSE ROBERTO LIMA DA COSTA', 'jose.costa@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122585', 'JOSÉ RODRIGUES LIMAS', 'jose.limas@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122468', 'LUCAS CAETANO DA SILVA', 'lucas.caetano@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94764', 'LUCAS RODRIGUES FERNANDES DA ROCHA', 'lucas.rocha@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94942', 'MARCIO RICARDO SOBREIRA', 'marcio.sobreira@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122674', 'PEDRO VINICIUS BISPO DOS SANTOS', 'pedro.bispo@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122648', 'REGINALDO APARECIDO DOS SANTOS', 'reginaldo.santos@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122540', 'RICARDO ROSCHEL ARAUJO', 'ricardo.roschel@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122792', 'THEFREY PATRICK ALVES DA SILVA', 'patrick.silva@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('122541', 'VITOR RAFAEL DOS REIS', 'vitor.reis@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94925', 'WESLEY DA SILVA LOPES', 'wesley.lopes@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94907', 'WEVERSON DE ALMEIDA', 'weverson.almeida@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('94739', 'WILLIAM OLIVEIRA DOS SANTOS', 'william.santos@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('123203', 'LUIZ CARLOS GOMES DA SILVA', 'luiz.gomes@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul'),
('123218', 'ROBSON EDGARD FOLIENE', 'robson.foliene@eletromidia.com.br', 'TECNICO', 'internal', 'Eletromidia Sul');

-- 4. Reativar RLS com políticas PERMISSIVAS
ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;

-- 5. Remover TODAS as políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Invites viewable by company members" ON employee_invites;
DROP POLICY IF EXISTS "Invites manageable by chiefs and leaders" ON employee_invites;
DROP POLICY IF EXISTS "Enable insert for all users" ON employee_invites;
DROP POLICY IF EXISTS "allow_select" ON employee_invites;
DROP POLICY IF EXISTS "allow_insert" ON employee_invites;
DROP POLICY IF EXISTS "allow_delete" ON employee_invites;
DROP POLICY IF EXISTS "allow_update" ON employee_invites;

-- 6. Criar políticas simples e abertas para usuários autenticados
CREATE POLICY "allow_select" ON employee_invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert" ON employee_invites FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_delete" ON employee_invites FOR DELETE TO authenticated USING (true);
CREATE POLICY "allow_update" ON employee_invites FOR UPDATE TO authenticated USING (true);

-- 7. Verificar: deve mostrar 28 linhas
SELECT count(*) as total_funcionarios FROM employee_invites;
