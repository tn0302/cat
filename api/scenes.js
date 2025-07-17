// import fetch from 'node-fetch'; は削除されていることを確認

// ... その他のコード（microCMS_API_BASE_URL, MICROCMS_API_KEY の定義、fetchAllDataWithPagination 関数など）

export default async (req, res) => {
    const { default: fetch } = await import('node-fetch'); // この行が関数の中に正しく存在することを確認
    // ... 残りの関数ロジック ...
};