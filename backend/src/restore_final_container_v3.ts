import fs from 'fs';
import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://user:password@db:5432/safeguardpro'
    });

    console.log('Iniciando restauração final v3...');
    const content = fs.readFileSync('/app/clean_data_for_node.txt', 'utf8');
    const lines = content.trim().split('\n');
    console.log(`Processando ${lines.length} linhas brutas...`);

    await pool.query('DELETE FROM certificate_templates');

    let count = 0;
    for (let row of lines) {
        if (!row.trim()) continue;

        // Split por TAB
        const parts = row.split('\t');
        if (parts.length < 7) continue;

        const id = parseInt(parts[0].trim());
        if (isNaN(id)) continue;

        const name = parts[2].trim();
        const bodyText = parts[5].replace(/\\n/g, '\n').trim();
        const versoText = parts[6].replace(/\\n/g, '\n').trim();

        await pool.query(
            'INSERT INTO certificate_templates (id, owner_id, name, image_url, created_at, body_text, verso_text) VALUES ($1, NULL, $2, NULL, NOW(), $3, $4)',
            [id, name, bodyText, versoText]
        );
        count++;
    }

    await pool.query("SELECT setval('certificate_templates_id_seq', (SELECT MAX(id) FROM certificate_templates))");
    console.log(`Restauração concluída: ${count} certificados inseridos.`);
    await pool.end();
}

run().catch(console.error);
