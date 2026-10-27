import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_FILE_PATTERNS = [
    /^\.env(\..+)?$/i,
    /\.(pem|key|p12|pfx|crt|sqlite|sqlite3|db|dump)$/i,
    /^debug_.*\.(cjs|js|ts)$/i,
    /^import_.*\.sql$/i,
    /^inserir_.*\.sql$/i,
    /^build_.*\.txt$/i,
    /^dev-dist\//i,
];

const ALLOWED_FILE_EXCEPTIONS = new Set(['.env.example']);

const SECRET_PATTERNS = [
    { name: 'Google / Gemini API Key (AIza...)', regex: /AIza[0-9A-Za-z\-_]{35}/g },
    { name: 'Supabase Secret Key (sb_secret_...)', regex: /sb_secret_[0-9A-Za-z\-_]{15,}/g },
    { name: 'Chave Privada CriptogrÃ¡fica (PEM)', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
    { name: 'Clerk Secret / Test Key', regex: /(?:sk_live_|sk_test_|pk_live_|pk_test_)[0-9A-Za-z\-_]{15,}/g },
    { name: 'Hardcoded Supabase Publishable Key', regex: /sb_publishable_[0-9A-Za-z\-_]{15,}/g },
];

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.html', '.sql', '.json', '.toml']);

let hasIssues = false;
const reportIssue = (msg) => {
    console.error(`âŒ [SECURITY BLOCK] ${msg}`);
    hasIssues = true;
};

console.log('ðŸ”’ Iniciando verificaÃ§Ã£o de seguranÃ§a e prevenÃ§Ã£o de vazamentos no Git...');

// 1. Verificar arquivos rastreados ou staged no Git
let trackedFiles = [];
try {
    const out = execSync('git ls-files', { encoding: 'utf8' });
    trackedFiles = out.split(/\r?\n/).filter(Boolean);
} catch (err) {
    console.error('Erro ao listar arquivos do Git:', err.message);
    process.exit(1);
}

for (const file of trackedFiles) {
    const base = path.basename(file);
    if (ALLOWED_FILE_EXCEPTIONS.has(file) || ALLOWED_FILE_EXCEPTIONS.has(base)) {
        continue;
    }

    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
        if (pattern.test(file) || pattern.test(base)) {
            reportIssue(`Arquivo sensÃ­vel ou proibido rastreado pelo Git: "${file}"`);
        }
    }

    const ext = path.extname(file).toLowerCase();
    if (!CODE_EXTENSIONS.has(ext) || file.endsWith('package-lock.json')) {
        continue;
    }

    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, 'utf8');
    for (const { name, regex } of SECRET_PATTERNS) {
        regex.lastIndex = 0;
        if (regex.test(content)) {
            reportIssue(`${name} detectada no arquivo rastreado: "${file}"`);
        }
    }
}

// 2. Verificar bundle de produÃ§Ã£o (dist/) se existir
if (fs.existsSync('dist')) {
    const walkDir = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (/\.(js|html|css|json|map)$/i.test(entry.name)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (/AIza[0-9A-Za-z\-_]{35}/.test(content)) {
                    reportIssue(`GEMINI/Google API Key vazada no bundle de build: "${fullPath}"`);
                }
                if (/sb_secret_[0-9A-Za-z\-_]{15,}/.test(content)) {
                    reportIssue(`Supabase Secret Key vazada no bundle de build: "${fullPath}"`);
                }
            }
        }
    };
    walkDir('dist');
}

if (hasIssues) {
    console.error('\nðŸš¨ VerificaÃ§Ã£o falhou! Corrija os itens acima antes de fazer commit ou deploy.');
    process.exit(1);
} else {
    console.log('âœ… VerificaÃ§Ã£o concluÃ­da: Nenhum segredo, chave privada ou arquivo proibido encontrado no Git ou no build!');
}

