// .env.local ファイルに以下のように記述します:
// GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec

export default async function handler(req, res) {
  const gasBaseUrl = process.env.GOOGLE_APPS_SCRIPT_URL; // 環境変数からGASのURLを取得

  if (!gasBaseUrl) {
    return res.status(500).json({ error: 'Google Apps Script URL is not configured.' });
  }

  // クエリパラメータを構築
  const queryParams = new URLSearchParams(req.query).toString();
  const gasUrl = `${gasBaseUrl}?${queryParams}`;

  try {
    const fetchOptions = {
      method: req.method, // クライアントからのHTTPメソッドをそのままGASに渡す
      headers: {
        // クライアントからのContent-TypeヘッダーをGASに渡す
        // 他のヘッダーも必要であればここで追加・転送可能
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
    };

    // POST, PUT, PATCHリクエストの場合、ボディを転送
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      fetchOptions.body = JSON.stringify(req.body); // Vercelはreq.bodyをJSONとしてパース済み
    }

    // GASへのリクエストを送信
    const gasResponse = await fetch(gasUrl, fetchOptions);

    // GASからのレスポンスのステータスとコンテンツタイプを取得
    // GASは常に200を返すため、gasResponseStatusは基本的に200になる
    const gasResponseContentType = gasResponse.headers.get('content-type') || 'application/json';
    const gasResponseData = await gasResponse.json(); // GASはJSONを返す想定

    // ブラウザへ返す最終的なHTTPステータスコードを決定
    let finalHttpStatus = gasResponse.status; // GASから返されたHTTPステータス (通常は200)

    // もしJSONボディ内に 'status' フィールドがあり、それが有効なHTTPステータスコードであれば、
    // その値を最終的なHTTPステータスコードとして採用する
    if (gasResponseData && typeof gasResponseData === 'object' && gasResponseData.status) {
        const jsonStatus = Number(gasResponseData.status);
        // 有効なHTTPステータスコードの範囲内かチェック (100-599)
        if (jsonStatus >= 100 && jsonStatus < 600) {
            finalHttpStatus = jsonStatus;
        }
    }

    // 【重要】Access-Control-Allow-OriginをVercelのドメインに設定
    // 厳密には req.headers.origin を使用し、許可されたオリジンのみを返すのがベストプラクティスですが、
    // 今回は問題を解決するため、'*' で全許可を試します。
    // 本番環境では、`https://cat-seven-blond.vercel.app` のように具体的に指定することを強く推奨します。
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // プリフライトリクエストのキャッシュ期間 (秒)

    // OPTIONSリクエスト（プリフライト）への対応
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // GASからのレスポンスデータをブラウザに返す
    res.status(finalHttpStatus).json(gasResponseData); // ★修正点: finalHttpStatus を使用

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: `Proxy failed to connect to GAS: ${error.message}` });
  }
}