
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'safeguardpro',
    password: process.env.DB_PASSWORD || 'postgres',
    port: Number(process.env.DB_PORT) || 5432,
});

async function runSchemaFix() {
    const client = await pool.connect();
    try {
        console.log('Applying schema fixes...');

        // 1. Fix sectors
        await client.query(`
      ALTER TABLE sectors 
      ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id) ON DELETE CASCADE;
    `);
        console.log('Fixed sectors table.');

        // 2. Fix inspection_answers
        await client.query(`
      ALTER TABLE inspection_answers 
      ADD COLUMN IF NOT EXISTS photo_after_url TEXT,
      ADD COLUMN IF NOT EXISTS photo_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS photo_lat DECIMAL,
      ADD COLUMN IF NOT EXISTS photo_lon DECIMAL;
    `);
        console.log('Fixed inspection_answers table.');

        console.log('Schema fix completed successfully.');
    } catch (err) {
        console.error('Error applying schema fix:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runSchemaFix();
