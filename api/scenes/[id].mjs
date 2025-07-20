// api/scenes/[id].mjs の先頭部分（抜粋）
import { createClient } from 'microcms-js-sdk';

const microcmsApiBaseUrl = process.env.MICROCMS_API_BASE_URL;
const apiKey = process.env.MICROCMS_API_KEY;

let client;
let serviceDomain = '';

try {
    if (microcmsApiBaseUrl) {
        const url = new URL(`https://${microcmsApiBaseUrl}`); 
        serviceDomain = url.host;

        if (!serviceDomain.includes('.microcms.io')) {
            throw new Error('Invalid MICROCMS_API_BASE_URL format for serviceDomain.');
        }
        client = createClient({ serviceDomain: serviceDomain, apiKey: apiKey });
    }
} catch (e) {
    console.error('MicroCMS client initialization failed at top level:', e.message);
    client = null;
}

export default async function handler(req, res) {
    // ... handler関数内の環境変数チェック ...
    if (!microcmsApiBaseUrl || !apiKey || !client) {
        return res.status(500).json({ error: 'Server configuration error: MicroCMS variables are missing or invalid, or client failed to initialize.' });
    }
    // ... 後続のPATCHロジック ...
}