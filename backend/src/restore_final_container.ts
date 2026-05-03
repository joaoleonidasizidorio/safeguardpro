import fs from 'fs';
import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://user:password@db:5432/safeguardpro'
    });

    console.log('Iniciando restauração final v2...');
    const content = fs.readFileSync('/app/clean_data_for_node.txt', 'utf16le'); // Tentando UTF16LE pois PowerShell Out-File -Encoding UTF8 costuma ser confuso

    // Fallback se UTF16 falhar
    let lines = content.trim().split('\n');
    if (lines.length < 5) {
        console.log('Tentando ler como UTF8...');
        const contentUtf8 = fs.readFileSync('/app/clean_data_for_node.txt', 'utf8');
        lines = contentUtf8.trim().split('\n');
    }

    console.log(`Processando ${lines.length} linhas brutas...`);

    await pool.query('DELETE FROM certificate_templates');

    let count = 0;
    for (let row of lines) {
        if (!row.trim()) continue;

        // Split por TAB ou múltiplos espaços
        const parts = row.split(/\t/);
        if (parts.length < 7) {
            // Tentar split por espaço duplo se tab falhar
            const partsAlt = row.split('  ');
            if (partsAlt.length < 7) continue;
        }

        const id = parseInt(parts[0]);
        if (isNaN(id)) continue;

        const ownerId = parts[1].trim() === '\\N' ? null : parts[1].trim();
        const name = parts[2].trim();
        const imageUrl = null;
        const createdAt = parts[4].trim();
        const bodyText = parts[5].replace(/\\n/g, '\n').trim();
        const versoText = parts[6].replace(/\\n/g, '\n').trim();

        await pool.query(
            'INSERT INTO certificate_templates (id, owner_id, name, image_url, created_at, body_text, verso_text) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, ownerId, name, imageUrl, createdAt, bodyText, versoText]
        );
        count++;
    }

    await pool.query("SELECT setval('certificate_templates_id_seq', (SELECT MAX(id) FROM certificate_templates))");
    console.log(`Restauração concluída: ${count} certificados inseridos.`);
    await pool.end();
}

run().catch(console.error);
