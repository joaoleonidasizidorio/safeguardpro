import fs from 'fs';
import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://user:password@db:5432/safeguardpro'
    });

    console.log('Lendo dados para restauração...');
    // No contêiner, o arquivo de dados estará em /app/restore_data_plain.sql
    const content = fs.readFileSync('/app/clean_data_for_node.txt', 'utf8');

    const rows = content.trim().split('\n');
    console.log(`Processando ${rows.length} registros...`);

    await pool.query('DELETE FROM certificate_templates');

    for (let row of rows) {
        const parts = row.split('\t');
        if (parts.length < 7) continue;

        const id = parseInt(parts[0]);
        const ownerId = parts[1] === '\\N' ? null : parts[1];
        const name = parts[2];
        const imageUrl = null;
        const createdAt = parts[4];
        const bodyText = parts[5].replace(/\\n/g, '\n');
        const versoText = parts[6].replace(/\\n/g, '\n');

        await pool.query(
            'INSERT INTO certificate_templates (id, owner_id, name, image_url, created_at, body_text, verso_text) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, ownerId, name, imageUrl, createdAt, bodyText, versoText]
        );
    }

    await pool.query("SELECT setval('certificate_templates_id_seq', (SELECT MAX(id) FROM certificate_templates))");
    console.log('Restauração concluída com sucesso!');
    await pool.end();
}

run().catch(console.error);
