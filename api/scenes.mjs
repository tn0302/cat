import axios from 'axios';

const MICROCMS_SERVICE_ID = process.env.MICROCMS_API_BASE_URL;
const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

async function fetchAllDataWithPagination(endpoint, filters = [], limit = 100, offset = 0) {
    let allData = [];
    let currentOffset = offset;
    let hasMore = true;

    if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
        throw new Error('MicroCMS environment variables are not set.');
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

            hasMore = data.contents.length >= limit;
            currentOffset += limit;
        } catch (error) {
            console.error('Error fetching data from microCMS:', error.response?.data || error.message);
            throw error;
        }
    }

    return allData;
}

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
        return assets?.[0]?.image || null;
    } catch (error) {
        console.error(`Error fetching asset by tag "${tag}":`, error.response?.data || error.message);
        throw error;
    }
}

export default async (req, res) => {
    try {
        if (!MICROCMS_SERVICE_ID || !MICROCMS_API_KEY) {
            return res.status(500).json({ error: 'MicroCMS configuration is missing.' });
        }

        if (req.method === 'GET') {
            const { episode } = req.query;
            if (!episode) {
                return res.status(400).json({ error: 'Episode parameter is required.' });
            }

            // 🔽 ここを修正：「"1"」のようにクオートで囲む
            const filters = [`episode[equals]"${episode}"`];
            console.log('Episode filter:', filters);

            const scenesData = await fetchAllDataWithPagination('scenes', filters);

            const enrichedScenes = await Promise.all(scenesData.map(async (scene) => {
                if (scene.background && typeof scene.background === 'string') {
                    const imageUrl = await fetchAssetImageUrlByTag(scene.background);
                    return { ...scene, background: imageUrl || scene.background };
                }
                return scene;
            }));

            res.status(200).json(enrichedScenes);

        } else if (req.method === 'PATCH') {
            const pathSegments = req.url.split('?')[0].split('/');
            const sceneId = pathSegments[pathSegments.length - 1];

            if (!sceneId) {
                return res.status(400).json({ error: 'Scene ID is required for update.' });
            }

            const updatedData = req.body;
            if (!updatedData || Object.keys(updatedData).length === 0) {
                return res.status(400).json({ error: 'No update data provided.' });
            }

            const updateUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v1/scenes/${sceneId}`;

            const response = await axios.put(updateUrl, updatedData, {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                    'Content-Type': 'application/json',
                },
            });

            res.status(200).json({
                message: 'Scene updated successfully.',
                updatedScene: response.data,
            });

        } else {
            res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error) {
        console.error('Unhandled API route error:', error.response?.data || error.message);
        res.status(500).json({ error: 'A server error occurred in the API route.', details: error.message });
    }
};
