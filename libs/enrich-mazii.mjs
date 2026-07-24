import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KANJI_VI_PATH = path.join(__dirname, '../assets/data/kanji_vi.json');
const BATCH_SIZE = 5;
const DELAY_MS = 200;

function fetchMazii(kanji) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ dict: 'javi', type: 'kanji', query: kanji });
        const req = https.request('https://mazii.net/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed && parsed.status === 200 && parsed.results && parsed.results.length > 0) {
                        resolve(parsed.results[0]);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.write(data);
        req.end();
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Loading kanji_vi.json...');
    const dict = JSON.parse(fs.readFileSync(KANJI_VI_PATH, 'utf8'));
    
    // Select targets: those with JLPT or high frequency
    const targets = Object.keys(dict).filter(k => dict[k].jlpt !== null || dict[k].freq !== null);
    console.log(`Targeting ${targets.length} kanjis...`);
    
    let processed = 0;
    
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const batch = targets.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (k) => {
            // Skip if already enriched
            if (dict[k].detail !== undefined && dict[k].mnemonic !== undefined) {
                return;
            }
            
            const maziiData = await fetchMazii(k);
            if (maziiData) {
                dict[k].mnemonic = maziiData.tips?.vi || "";
                dict[k].detail = maziiData.detail || "";
                dict[k].compDetail = maziiData.compDetail || [];
            } else {
                dict[k].mnemonic = "";
                dict[k].detail = "";
                dict[k].compDetail = [];
            }
        }));
        
        processed += batch.length;
        if (processed % 100 === 0 || processed >= targets.length) {
            console.log(`Processed ${processed}/${targets.length}...`);
            // Save periodically
            fs.writeFileSync(KANJI_VI_PATH, JSON.stringify(dict));
        }
        
        await delay(DELAY_MS);
    }
    
    console.log('Finished enriching kanji data.');
}

main().catch(console.error);
