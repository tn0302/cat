// .env.local に以下のように記述してください
// GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec

export default async function handler(req, res) {
  const gasBaseUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!gasBaseUrl) {
    return res.status(500).json({ error: 'Google Apps Script URL is not configured.' });
  }

  // クエリパラメータを構築
  const queryParams = new URLSearchParams(req.query).toString();
  const gasUrl = `${gasBaseUrl}?${queryParams}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const gasResponse = await fetch(gasUrl, fetchOptions);

    // JSON ではなく text として取得してから parse を試みる
    const gasText = await gasResponse.text();
    let gasResponseData;
    try {
      gasResponseData = JSON.parse(gasText);
    } catch {
      gasResponseData = {
        error: 'Invalid JSON response from GAS',
        body: gasText,
      };
    }

    // レスポンスステータスコード（GASは基本200）
    let finalHttpStatus = gasResponse.status;

    // JSON内に status フィールドがあればそれを使う
    if (gasResponseData && typeof gasResponseData === 'object' && gasResponseData.status) {
      const jsonStatus = Number(gasResponseData.status);
      if (jsonStatus >= 100 && jsonStatus < 600) {
        finalHttpStatus = jsonStatus;
      }
    }

    // CORSヘッダー
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // ブラウザに返す
    res.status(finalHttpStatus).json(gasResponseData);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: `Proxy failed to connect to GAS: ${error.message}` });
  }
}
