
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { Pool } from 'pg';

export async function importPPTXFolder(pool: Pool, userId: number) {
    const sourceDir = '/app/import_source'; // Mapped from 'CERTIFICADOS MODELOS'
    const destDir = path.join(__dirname, '../uploads/templates');

    if (!fs.existsSync(sourceDir)) {
        console.error('Source directory not found:', sourceDir);
        return { error: 'Source directory not found. Check docker volume.' };
    }
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.pptx'));
    const results = [];

    for (const file of files) {
        console.log(`Processing ${file}...`);
        try {
            const zip = new AdmZip(path.join(sourceDir, file));
            const zipEntries = zip.getEntries();

            // 1. Extract Text from slide1.xml
            let bodyText = '';
            const slideEntry = zipEntries.find(e => e.entryName === 'ppt/slides/slide1.xml');
            if (slideEntry) {
                const xml = slideEntry.getData().toString('utf8');
                const result = await parseStringPromise(xml);
                // Deep traverse to find all <a:t>
                bodyText = extractText(result);
            }

            // 2. Extract Background Image from ppt/media
            let imageUrl = '';
            // Find image files in ppt/media
            const mediaEntries = zipEntries.filter(e => e.entryName.startsWith('ppt/media/'));
            // Sort by size (largest is likely background)
            mediaEntries.sort((a, b) => b.header.compressedSize - a.header.compressedSize);

            if (mediaEntries.length > 0) {
                const bgEntry = mediaEntries[0];
                const ext = path.extname(bgEntry.name); // .jpeg, .png
                const newFileName = `imported-${Date.now()}-${path.basename(file, '.pptx')}${ext}`;
                const newPath = path.join(destDir, newFileName);

                fs.writeFileSync(newPath, bgEntry.getData());
                imageUrl = `/uploads/templates/${newFileName}`;
            } else {
                // Fallback: Use a generic placeholder if no image found (unlikely for Certs)
                console.warn(`No image found in ${file}`);
            }

            // 3. Save to DB
            const name = path.basename(file, '.pptx').replace(/[+_-]/g, ' '); // Clean name

            // Clean body text (simple punctuation fix)
            // bodyText can be messy depending on PPTX structure

            const dbRes = await pool.query(
                'INSERT INTO certificate_templates (owner_id, name, image_url, body_text) VALUES ($1, $2, $3, $4) RETURNING *',
                [userId, name, imageUrl, bodyText]
            );
            results.push(dbRes.rows[0]);

        } catch (err) {
            console.error(`Error importing ${file}:`, err);
        }
    }

    return { success: true, count: results.length, imported: results };
}

function extractText(obj: any): string {
    let text = '';
    if (typeof obj === 'object') {
        for (const key in obj) {
            if (key === 'a:t') {
                const val = obj[key];
                if (Array.isArray(val)) text += val.join(' ') + ' ';
                else text += val + ' ';
            } else {
                text += extractText(obj[key]);
            }
        }
    } else if (Array.isArray(obj)) {
        for (const item of obj) {
            text += extractText(item);
        }
    }
    return text;
}
