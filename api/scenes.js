// import fetch from 'node-fetch'; は削除します

// 以下は既存の microCMS_API_BASE_URL と microCMS_API_KEY の定義
// .env を使用する場合
const MICROCMS_API_BASE_URL = process.env.MICROCMS_API_BASE_URL;
const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

// あるいは、ハードコードされている場合 (非推奨ですが、デバッグ用)
// const MICROCMS_API_BASE_URL = 'YOUR_MICROCMS_SERVICE_ID.microcms.io/api/v1'; // サービスIDを置き換える
// const MICROCMS_API_KEY = 'YOUR_API_KEY'; // APIキーを置き換える

// fetchAllDataWithPagination 関数はそのまま
async function fetchAllDataWithPagination(endpoint, filters = [], limit = 100, offset = 0) {
    const { default: fetch } = await import('node-fetch'); // ここで動的にインポート！
    let allData = [];
    let currentOffset = offset;
    let hasMore = true;

    while (hasMore) {
        const url = new URL(`https://${MICROCMS_API_BASE_URL}/${endpoint}`);
        url.searchParams.append('limit', limit);
        url.searchParams.append('offset', currentOffset);
        filters.forEach(filter => url.searchParams.append('filters', filter));

        console.log(`Fetching data from: ${url.toString()}`);

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorText}`);
            }

            const data = await response.json();
            allData = allData.concat(data.contents);

            if (data.contents.length < limit) {
                hasMore = false;
            } else {
                currentOffset += limit;
            }
        } catch (error) {
            console.error(`Error fetching data from microCMS: ${error}`);
            throw error;
        }
    }
    return allData;
}


export default async (req, res) => {
    try {
        const { episode } = req.query;
        if (!episode) {
            return res.status(400).json({ error: 'Episode parameter is required.' });
        }

        const filters = [`episode[equals]${episode}`];
        console.log(`Loading data for episode: ${episode}`);
        const data = await fetchAllDataWithPagination('scenes', filters);

        res.status(200).json(data);
    } catch (error) {
        console.error('Error in API route:', error);
        // エラーレスポンスをより具体的にするため、エラーメッセージを含める
        res.status(500).json({ error: 'A server error occurred while fetching episode data.', details: error.message });
    }
};