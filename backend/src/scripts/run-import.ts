
import { Pool } from 'pg';
import { importPPTXFolder } from '../pptx-import';
import dotenv from 'dotenv';
import path from 'path';

// Load env (if running via ts-node locally, might need it. In docker env is set)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

(async () => {
    console.log('Starting PPTX Import...');
    try {
        // Assuming Admin ID = 1 (Standard for first user)
        // If user deleted ID 1, this might reference non-existent.
        // I'll query for first user just in case.
        const uRes = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
        const userId = uRes.rows[0]?.id || 1;

        const result = await importPPTXFolder(pool, userId);
        console.log('Import Result:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Import Failed:', err);
        process.exit(1);
    }
})();
