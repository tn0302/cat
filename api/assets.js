// api/assets.js
import axios from 'axios'; // axiosをインポート

export default async (req, res) => {
    // 環境変数からサービスIDとコンテンツAPIキーを取得
    // MICROCMS_API_BASE_URL はサービスID、MICROCMS_API_KEY はコンテンツAPIキーを想定
    const MICROCMS_SERVICE_ID = process.env.MICROCMS_API_BASE_URL; // 例: "nvw9sy9y9b"
    const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY; // コンテンツAPIキーを使用

    if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
        console.error('Server configuration error: MicroCMS environment variables (SERVICE_ID or API_KEY) are not set.');
        return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set.' });
    }

    const { filters } = req.query; // クライアントから渡されたfiltersクエリパラメータを取得
    
    // MicroCMSのコンテンツAPI v1のエンドポイントを使用
    const baseApiUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/assets`;

    const url = new URL(baseApiUrl);
    url.searchParams.append('limit', 100); // 一度に取得する件数 (必要に応じて調整)

    // filtersが存在する場合、URLに結合
    if (filters) {
        // filtersパラメータは文字列としてURLSearchParamsに追加
        url.searchParams.append('filters', filters);
    }

    console.log(`Fetching assets from MicroCMS: ${url.toString()}`);

    try {
        const response = await axios.get(url.toString(), {
            headers: {
                'X-MICROCMS-API-KEY': MICROCMS_API_KEY, // コンテンツAPIキーをヘッダーに設定
            },
        });

        if (response.status !== 200) {
            console.error(`MicroCMS API returned non-200 status for assets: ${response.status}, ${response.statusText}`);
            return res.status(response.status).json({ error: response.statusText, details: response.data });
        }

        // MicroCMSのAPIは { contents: [...], totalCount: N } 形式で返すため、
        // `index.html`の`fetchAllDataWithPagination`が期待する直接配列の形式で返す
        res.status(200).json(response.data.contents); // contents配列のみを返す

    } catch (error) {
        console.error('Proxy error for assets API:', error);
        if (error.response) {
            // Axiosからの詳細なエラーレスポンスをログに出力
            console.error('Axios error response data:', error.response.data);
            console.error('Axios error response status:', error.response.status);
            console.error('Axios error response headers:', error.response.headers);
        }
        res.status(500).json({ error: 'Failed to proxy request to MicroCMS assets API.', details: error.message });
    }
};