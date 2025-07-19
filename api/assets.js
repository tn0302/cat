// api/assets.js
// microCMSの「アセット」エンドポイントへのプロキシ

export default async function handler(req, res) { // 関数名を 'handler' に変更するとVercelでより一般的な慣習に沿います
    // 環境変数からサービスIDとコンテンツAPIキーを取得
    // ★ここを修正: MICROCMS_API_BASE_URL ではなく MICROCMS_SERVICE_ID から取得します
    const MICROCMS_SERVICE_ID = process.env.MICROCMS_SERVICE_ID;
    const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY; // コンテンツAPIキーを使用

    if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
        console.error('Server configuration error: MicroCMS environment variables (SERVICE_ID or API_KEY) are not set.');
        return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set.' });
    }

    const { filters } = req.query; // クライアントから渡されたfiltersクエリパラメータを取得

    // MicroCMSのコンテンツAPI v1のエンドポイントを使用
    // ★サービスIDを使って正しいMicroCMSのAPIベースURLを構築します
    const baseApiUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/assets`;

    const url = new URL(baseApiUrl);
    url.searchParams.append('limit', 100); // 一度に取得する件数 (必要に応じて調整)

    // filtersが存在する場合、URLに結合
    if (filters) {
        url.searchParams.append('filters', filters);
    }

    console.log(`Fetching assets from MicroCMS: ${url.toString()}`);

    try {
        const microCMSRes = await fetch(url.toString(), {
            method: 'GET', // アセット取得はGETメソッド
            headers: {
                'X-MICROCMS-API-KEY': MICROCMS_API_KEY, // コンテンツAPIキーをヘッダーに設定
            },
        });

        // HTTPステータスが200番台でなければエラーとして処理
        if (!microCMSRes.ok) {
            const errorText = await microCMSRes.text(); // エラーレスポンスをテキストとして取得
            console.error(`MicroCMS API returned non-OK status for assets: ${microCMSRes.status}, ${microCMSRes.statusText}`);
            console.error('MicroCMS error response body:', errorText);
            return res.status(microCMSRes.status).json({ error: microCMSRes.statusText, details: errorText });
        }

        const data = await microCMSRes.json();

        // MicroCMSのAPIは { contents: [...], totalCount: N } 形式で返すため、
        // `index.html`の`fetchAllDataWithPagination`が期待する直接配列の形式で返す
        res.status(200).json(data.contents); // contents配列のみを返す

    } catch (error) {
        console.error('Proxy error for assets API:', error);
        res.status(500).json({ error: 'Failed to proxy request to MicroCMS assets API.', details: error.message });
    }
}