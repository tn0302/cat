// .env.local に以下のように記述してください
// GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec

export default async function handler(req, res) {
  const gasBaseUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  if (!gasBaseUrl) {
    return res.status(500).json({ error: 'Google Apps Script URL is not configured.' });
  }

  // 実際のメソッドと送信先のGAS用メソッドを分離
  const actualMethod = req.method;
  let methodForGAS = actualMethod;
  let query = req.query;

  // PUT や DELETE などは POST に変換し、_method パラメータを追加
  if (actualMethod === 'PUT' || actualMethod === 'DELETE') {
    methodForGAS = 'POST';
    query = { ...query, _method: actualMethod }; // クエリパラメータに _method を追加
  }

  // クエリパラメータを構築
  const queryParams = new URLSearchParams(query).toString();
  const gasUrl = `${gasBaseUrl}?${queryParams}`;

  try {
    const fetchOptions = {
      method: methodForGAS, // GASへは実際に送るメソッド（GET or POST）
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(actualMethod)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const gasResponse = await fetch(gasUrl, fetchOptions);

    // GAS のレスポンスをテキストとして取得し、JSONにパースを試みる
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

    // GASのレスポンスコード（基本は200だが、JSON中に status があれば優先）
    let finalHttpStatus = gasResponse.status;
    if (gasResponseData && typeof gasResponseData === 'object' && gasResponseData.status) {
      const jsonStatus = Number(gasResponseData.status);
      if (jsonStatus >= 100 && jsonStatus < 600) {
        finalHttpStatus = jsonStatus;
      }
    }

    // CORS 対応
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // ブラウザにレスポンス返却
    res.status(finalHttpStatus).json(gasResponseData);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: `Proxy failed to connect to GAS: ${error.message}` });
  }
}
