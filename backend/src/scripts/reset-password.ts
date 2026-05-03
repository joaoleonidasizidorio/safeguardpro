
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

(async () => {
    const email = process.argv[2] || 'admin@safeguardpro.com';
    const newPassword = process.argv[3] || 'admin123';

    console.log(`Resetting password for ${email} to '${newPassword}'...`);

    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(newPassword, saltRounds);

        const res = await pool.query(
            'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email, role',
            [hash, email]
        );

        if (res.rowCount === 0) {
            console.error(`User ${email} not found.`);
            process.exit(1);
        }

        console.log('Password updated successfully:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('Error resetting password:', err);
        process.exit(1);
    }
})();
