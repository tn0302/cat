import axios from 'axios';

// 環境変数からサービスIDとAPIキーを取得
// Vercelの環境変数 MICROCMS_API_BASE_URL にサービスID (例: "nvw9sy9y9b") が設定されていると仮定
const MICROCMS_SERVICE_ID = process.env.MICROCMS_API_BASE_URL;
const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

// MicroCMSからデータをページネーションで全て取得する汎用関数
async function fetchAllDataWithPagination(endpoint, filters = [], limit = 100, offset = 0) {
    let allData = [];
    let currentOffset = offset;
    let hasMore = true;

    if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
        throw new Error('MicroCMS environment variables (MICROCMS_API_BASE_URL or MICROCMS_API_KEY) are not set.');
    }
    const baseApiUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/${endpoint}`;

    while (hasMore) {
        const url = new URL(baseApiUrl);
        url.searchParams.append('limit', limit);
        url.searchParams.append('offset', currentOffset);
        filters.forEach(filter => url.searchParams.append('filters', filter));

        console.log(`Fetching data from: ${url.toString()}`);

        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                },
            });

            if (response.status !== 200) {
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}`);
            }

            const data = response.data;
            allData = allData.concat(data.contents);

            if (data.contents.length < limit) {
                hasMore = false;
            } else {
                currentOffset += limit;
            }
        } catch (error) {
            console.error(`Error fetching data from microCMS with axios: ${error}`);
            if (error.response) {
                console.error('Axios error response data:', error.response.data);
                console.error('Axios error response status:', error.response.status);
                console.error('Axios error response headers:', error.response.headers);
            }
            throw error;
        }
    }
    return allData;
}

// MicroCMSのassetsからタグを使って画像URLを取得するヘルパー関数
async function fetchAssetImageUrlByTag(tag) {
    if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
        throw new Error('MicroCMS environment variables are not set.');
    }
    const assetApiUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/assets?filters=tag[equals]${tag}`;
    console.log(`Fetching asset by tag: ${tag} from ${assetApiUrl}`);

    try {
        const response = await axios.get(assetApiUrl, {
            headers: {
                'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
            },
        });
        if (response.status !== 200) {
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}`);
        }
        const assets = response.data.contents;
        if (assets && assets.length > 0) {
            // 最初のマッチしたアセットのimage.urlを返す
            return assets[0].image;
        }
        console.warn(`No asset found for tag: ${tag}`);
        return null; // アセットが見つからない場合
    } catch (error) {
        console.error(`Error fetching asset by tag "${tag}":`, error);
        throw error;
    }
}

// APIルートのハンドラー
export default async (req, res) => {
    try {
        const { episode } = req.query;
        if (!episode) {
            return res.status(400).json({ error: 'Episode parameter is required.' });
        }

        const filters = [`episode[equals]${episode}`];
        console.log(`Loading scenes data for episode: ${episode}`);
        // まず、シーンデータを取得
        const scenesData = await fetchAllDataWithPagination('scenes', filters);

        // シーンデータ内の background フィールドを、対応するアセットの画像URLに変換
        const enrichedScenes = await Promise.all(scenesData.map(async (scene) => {
            // background が文字列（タグ名）であり、かつ存在する場合のみ処理
            if (scene.background && typeof scene.background === 'string') {
                const imageUrl = await fetchAssetImageUrlByTag(scene.background);
                if (imageUrl) {
                    // background フィールドを画像URLに置き換える
                    return { ...scene, background: imageUrl };
                }
            }
            // background がない、または文字列でない、またはアセットが見つからない場合はそのまま返す
            return scene;
        }));

        res.status(200).json(enrichedScenes);
    } catch (error) {
        console.error('Error in API route:', error);
        res.status(500).json({ error: 'A server error occurred while fetching episode data.', details: error.message });
    }
};