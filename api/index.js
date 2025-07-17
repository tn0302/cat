// api/index.js

import fetch from 'node-fetch'; // Vercelの環境では 'node-fetch' が利用可能です

// Vercelの環境変数からAPIキーなどを取得
const MICROCMS_SERVICE_ID = process.env.MICROCMS_SERVICE_ID;
const MICROCMS_API_KEY = process.env.MICROCMS_MANAGEMENT_API_KEY; // または閲覧用キー

export default async function (req, res) {
  // リクエストのパスに応じて、microCMSのどのエンドポイントに転送するかを決定
  const path = req.url.split('/api')[1]; // 例: /scenes?filters=... や /assets?limit=...
  const microCMSUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v2${path}`;

  try {
    const microCMSRes = await fetch(microCMSUrl, {
      method: req.method, // クライアントからのリクエストメソッドをそのまま転送
      headers: {
        'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
        'Content-Type': req.headers['content-type'] || 'application/json', // Content-Typeも転送
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined, // GET/HEAD以外はbodyを転送
    });

    const data = await microCMSRes.json();

    // microCMSからのレスポンスをクライアントに返す
    res.status(microCMSRes.status).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
