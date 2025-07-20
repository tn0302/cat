// your-project-root/api/assets.js
// microCMSの「アセット」エンドポイントへのプロキシ (axiosなし版)

export default async function (req, res) {
    // 環境変数から完全なAPIベースURLとAPIキーを取得
    // Vercelの環境変数 MICROCMS_API_BASE_URL には "your-service-id.microcms.io/api/v1" が設定されていると仮定
    const MICROCMS_API_BASE_URL_FULL = process.env.MICROCMS_API_BASE_URL; // 例: "nvw9sy9y9b.microcms.io/api/v1"
    const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY; // コンテンツAPIキーを使用

    // MICROCMS_API_BASE_URL_FULL からサービスID（例: "nvw9sy9y9b"）を抽出
    let MICROCMS_SERVICE_ID_ONLY = '';
    if (MICROCMS_API_BASE_URL_FULL) {
        try {
            // "https://your-service-id.microcms.io/api/v1" から "your-service-id" を抽出
            // URLオブジェクトを使うと安全にホスト名を取得でき、そこからサービスIDを切り出す
            const urlObj = new URL(`https://${MICROCMS_API_BASE_URL_FULL}`);
            const host = urlObj.host; // "your-service-id.microcms.io"
            MICROCMS_SERVICE_ID_ONLY = host.split('.')[0]; // "your-service-id"
        } catch (e) {
            console.error('Error parsing MICROCMS_API_BASE_URL_FULL for service ID in assets.js:', e.message);
            // エラーハンドリングは後続のチェックに任せる
        }
    }

    if (!MICROCMS_API_BASE_URL_FULL || !MICROCMS_API_KEY || !MICROCMS_SERVICE_ID_ONLY) {
        console.error('Server configuration error: MicroCMS environment variables (API_BASE_URL or API_KEY) are not set or improperly formatted in assets.js.');
        return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set or invalid.' });
    }

    const { filters } = req.query; // クライアントから渡されたfiltersクエリパラメータを取得
    
    // MicroCMSのコンテンツAPI v1のエンドポイントを使用
    // 抽出したサービスIDを使用してURLを構築
    const baseApiUrl = `https://${MICROCMS_SERVICE_ID_ONLY}.microcms.io/api/v1/assets`; // v1を使用

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
        // `index.html`での利用に合わせて contents 配列を直接返す
        return res.status(200).json(data.contents);
    } catch (error) {
        console.error('Error in assets API route:', error);
        return res.status(500).json({ error: 'Failed to fetch assets.', details: error.message });
    }
}