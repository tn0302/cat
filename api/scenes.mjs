// api/scenes.mjs
// microCMSの「シーン」エンドポイントへのプロキシ (axiosなし版)

export default async function (req, res) {
    // 環境変数からサービスIDとコンテンツAPIキーを取得
    const MICROCMS_SERVICE_ID = process.env.MICROCMS_API_BASE_URL; // 例: "nvw9sy9y9b"
    const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY; // コンテンツAPIキーを使用

    if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
        console.error('Server configuration error: MicroCMS environment variables (SERVICE_ID or API_KEY) are not set.');
        return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set.' });
    }

    const { episodeId } = req.query; // episodeIdを取得
    const baseApiUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/scenes`;

    const url = new URL(baseApiUrl);
    url.searchParams.append('limit', 100); // ページネーション対応のため、まずは多めに取得
    url.searchParams.append('filters', `episode[equals]${episodeId}`); // episodeIdでフィルタリング

    console.log(`Fetching scenes from MicroCMS: ${url.toString()}`);

    try {
        const microCMSRes = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'X-MICROCMS-API-KEY': MICROCMS_API_KEY, // コンテンツAPIキーをヘッダーに設定
            },
        });

        // HTTPステータスが200番台でなければエラーとして処理
        if (!microCMSRes.ok) {
            const errorText = await microCMSRes.text(); // エラーレスポンスをテキストとして取得
            console.error(`MicroCMS API returned non-OK status for scenes: ${microCMSRes.status}, ${microCMSRes.statusText}`);
            console.error('MicroCMS error response body:', errorText);
            return res.status(microCMSRes.status).json({ error: microCMSRes.statusText, details: errorText });
        }

        const data = await microCMSRes.json();

        // MicroCMSのAPIは { contents: [...], totalCount: N } 形式で返すため、
        // `index.html`の`fetchAllDataWithPagination`が期待する直接配列の形式で返す
        res.status(200).json(data.contents); // contents配列のみを返す

    } catch (error) {
        console.error('Proxy error for scenes API:', error);
        res.status(500).json({ error: 'Failed to proxy request to MicroCMS scenes API.', details: error.message });
    }
}