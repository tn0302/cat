// api/assets.js

// microCMSの「アセット」エンドポイントへのプロキシ



import fetch from 'node-fetch';



export default async function (req, res) {

  const MICROCMS_SERVICE_ID = process.env.MICROCMS_SERVICE_ID;

  const ASSETS_API_KEY = process.env.MICROCMS_MANAGEMENT_API_KEY; // またはコンテンツAPIの書き込みキー



  if (!MICROCMS_SERVICE_ID || !ASSETS_API_KEY) {

    return res.status(500).json({ error: 'Server configuration error: microCMS environment variables are not set.' });

  }



  const queryParams = new URLSearchParams(req.query).toString();

  const microCMSUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v2/assets?${queryParams}`;



  try {

    const microCMSRes = await fetch(microCMSUrl, {

      method: req.method,

      headers: {

        'X-MICROCMS-API-KEY': ASSETS_API_KEY,

        'Content-Type': req.headers['content-type'] || 'application/json',

      },

      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,

    });



    const data = await microCMSRes.json();

    res.status(microCMSRes.status).json(data);



  } catch (error) {

    console.error('Proxy error for assets API:', error);

    res.status(500).json({ error: 'Failed to proxy request to microCMS assets API.' });

  }

}