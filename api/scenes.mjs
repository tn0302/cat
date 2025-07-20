import axios from 'axios';

// 環境変数から完全なAPIベースURLとAPIキーを取得
// Vercelの環境変数 MICROCMS_API_BASE_URL には "your-service-id.microcms.io/api/v1" が設定されていると仮定
const MICROCMS_API_BASE_URL_FULL = process.env.MICROCMS_API_BASE_URL;
const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

// MICROCMS_API_BASE_URL_FULL からサービスID（例: "nvw9sy9y9b"）を抽出
let MICROCMS_SERVICE_ID_ONLY = '';
if (MICROCMS_API_BASE_URL_FULL) {
    try {
        // "https://your-service-id.microcms.io/api/v1" から "your-service-id" を抽出
        const urlParts = MICROCMS_API_BASE_URL_FULL.split('.');
        if (urlParts.length > 0) {
            MICROCMS_SERVICE_ID_ONLY = urlParts[0];
        }
    } catch (e) {
        console.error('Error parsing MICROCMS_API_BASE_URL_FULL for service ID:', e.message);
        // エラーハンドリングは後続のチェックに任せる
    }
}


// MicroCMSからデータをページネーションで全て取得する汎用関数
async function fetchAllDataWithPagination(endpoint, filters = [], limit = 100, offset = 0) {
    let allData = [];
    let currentOffset = offset;
    let hasMore = true;

    // 環境変数のチェック
    if (!MICROCMS_API_BASE_URL_FULL || !MICROCMS_API_KEY || !MICROCMS_SERVICE_ID_ONLY) {
        throw new Error('MicroCMS environment variables are not correctly set or parsed.');
    }
    
    // 抽出したサービスIDを使用してURLを構築
    const baseApiUrl = `https://${MICROCMS_SERVICE_ID_ONLY}.microcms.io/api/v1/${endpoint}`;

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
    // 環境変数のチェック
    if (!MICROCMS_API_BASE_URL_FULL || !MICROCMS_API_KEY || !MICROCMS_SERVICE_ID_ONLY) {
        throw new Error('MicroCMS environment variables are not correctly set or parsed.');
    }
    // 抽出したサービスIDを使用してURLを構築
    const assetApiUrl = `https://${MICROCMS_SERVICE_ID_ONLY}.microcms.io/api/v1/assets?filters=tag[equals]${tag}`;
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
        // --- 環境変数と抽出されたサービスIDの最終チェック ---
        if (!MICROCMS_API_BASE_URL_FULL || !MICROCMS_API_KEY || !MICROCMS_SERVICE_ID_ONLY) {
            console.error('MicroCMS environment variables (MICROCMS_API_BASE_URL or MICROCMS_API_KEY) are not set or improperly formatted.');
            return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set or invalid.' });
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
            // ★重要★ api/scenes/[id].mjs が PATCH リクエストを処理するため、
            // こちらの PATCH ブロックは削除するか、コメントアウトしてください。
            // 現在、このブロックは不要であり、混乱の原因となります。
            console.warn('Attempted PATCH request on api/scenes.mjs, but it should be handled by api/scenes/[id].mjs. This block should be removed.');
            res.status(405).json({ error: 'Method Not Allowed - PATCH requests for specific IDs are handled by /api/scenes/[id].' });

            // 以下のコードは削除するか、完全にコメントアウトしてください
            /*
            const pathSegments = req.url.split('?')[0].split('/');
            const sceneId = pathSegments[pathSegments.length - 1]; 

            if (!sceneId) {
                return res.status(400).json({ error: 'Scene ID is required for update.' });
            }

            const updatedData = req.body; 

            if (!updatedData || Object.keys(updatedData).length === 0) {
                return res.status(400).json({ error: 'No update data provided.' });
            }

            console.log(`Updating scene ID: ${sceneId} with data:`, updatedData);

            try {
                // ここでも MICROCMS_SERVICE_ID_ONLY を使うべき
                const microCMSUpdateUrl = `https://${MICROCMS_SERVICE_ID_ONLY}.microcms.io/api/v1/scenes/${sceneId}`;
                
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
            */

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