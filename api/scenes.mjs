import axios from 'axios';

// 環境変数からサービスIDとAPIキーを取得
const MICROCMS_SERVICE_ID = process.env.MICROCMS_API_BASE_URL;
const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

// MicroCMSからデータをページネーションで全て取得する汎用関数 (変更なし)
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

// MicroCMSのassetsからタグを使って画像URLを取得するヘルパー関数 (変更なし)
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
            return assets[0].image; // 最初のマッチしたアセットのimage.urlを返す
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
        // --- 環境変数チェック ---
        if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
            console.error('MicroCMS environment variables (MICROCMS_API_BASE_URL or MICROCMS_API_KEY) are not set.');
            return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set.' });
        }

        // --- リクエストメソッドによる分岐 ---
        if (req.method === 'GET') {
            const { episode } = req.query;
            if (!episode) {
                return res.status(400).json({ error: 'Episode parameter is required.' });
            }

            const filters = [`episode[equals]${episode}`];
            console.log(`Loading scenes data for episode: ${episode}`);
            const scenesData = await fetchAllDataWithPagination('scenes', filters);

            // シーンデータ内の background フィールドを、対応するアセットの画像URLに変換
            const enrichedScenes = await Promise.all(scenesData.map(async (scene) => {
                if (scene.background && typeof scene.background === 'string') {
                    const imageUrl = await fetchAssetImageUrlByTag(scene.background);
                    if (imageUrl) {
                        return { ...scene, background: imageUrl };
                    }
                }
                return scene;
            }));

            res.status(200).json(enrichedScenes);

        } else if (req.method === 'PATCH') {
            // --- PATCHリクエストの処理 ---
            // URLからシーンIDを抽出 (例: /api/scenes/hkc2mgy70 -> hkc2mgy70)
            const pathSegments = req.url.split('?')[0].split('/');
            const sceneId = pathSegments[pathSegments.length - 1]; 

            if (!sceneId) {
                return res.status(400).json({ error: 'Scene ID is required for update.' });
            }

            // リクエストボディから更新データを取得 (Vercelはreq.bodyを自動でパースします)
            const updatedData = req.body; 

            if (!updatedData || Object.keys(updatedData).length === 0) {
                return res.status(400).json({ error: 'No update data provided.' });
            }

            console.log(`Updating scene ID: ${sceneId} with data:`, updatedData);

            try {
                const microCMSUpdateUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/scenes/${sceneId}`;
                
                // MicroCMSはPUTメソッドを推奨しますが、PATCHも利用可能です。
                // PUTは全体更新ですが、MicroCMSではPATCHと同様に部分更新のように振る舞うことが多いです。
                const response = await axios.put(microCMSUpdateUrl, updatedData, { 
                    headers: {
                        'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.status !== 200) {
                    throw new Error(`MicroCMS update HTTP error! Status: ${response.status}, Message: ${response.statusText}`);
                }

                console.log(`Scene ID: ${sceneId} updated successfully.`);
                res.status(200).json({ message: 'Scene updated successfully.', updatedScene: response.data });

            } catch (updateError) {
                console.error(`Error updating scene ID ${sceneId}:`, updateError);
                if (updateError.response) {
                    console.error('Axios update error response data:', updateError.response.data);
                    console.error('Axios update error response status:', updateError.response.status);
                }
                res.status(500).json({ error: 'Internal server error while updating scene.', details: updateError.message });
            }

        } else {
            // --- 未対応のメソッドの場合 ---
            res.status(405).json({ error: 'Method Not Allowed' });
        }

    } catch (error) {
        console.error('Error in API route:', error);
        // 環境変数エラーなどの詳細も含む
        res.status(500).json({ error: 'A server error occurred in the API route.', details: error.message });
    }
};