import axios from 'axios'; // ファイルの先頭にこの行を追加

// 以下は既存の microCMS_API_BASE_URL と microCMS_API_KEY の定義
const MICROCMS_API_BASE_URL = process.env.MICROCMS_API_BASE_URL;
const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

// fetchAllDataWithPagination 関数をaxiosを使用するように修正
async function fetchAllDataWithPagination(endpoint, filters = [], limit = 100, offset = 0) {
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
            // ここをaxios.getに置き換え
            const response = await axios.get(url.toString(), {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                },
            });

            // axiosはresponse.okではなくstatusコードで成功を判断します
            if (response.status !== 200) {
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}`);
            }

            const data = response.data; // axiosはJSONを自動でパースしてくれます
            allData = allData.concat(data.contents);

            if (data.contents.length < limit) {
                hasMore = false;
            } else {
                currentOffset += limit;
            }
        } catch (error) {
            console.error(`Error fetching data from microCMS with axios: ${error}`);
            // axiosのエラーはresponseプロパティを持つ場合があります
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
        res.status(500).json({ error: 'A server error occurred while fetching episode data.', details: error.message });
    }
};