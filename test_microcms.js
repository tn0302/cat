require('dotenv').config(); // .envファイルを読み込む
const axios = require('axios'); // axios を使用

// microCMS API設定
const MICROCMS_SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_ID;
const MICROCMS_API_KEY = process.env.MICROCMS_MANAGEMENT_API_KEY; 
const TEST_ENDPOINT = 'test_assets'; // ★ステップ1で作成した新しいコンテンツタイプのエンドポイントID

// microCMS APIのベースURL
const microCMSBaseUrl = `https://${MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1`;

async function sendTestAssetToMicroCMS() {
    const testContent = {
        test_type: 'value_a', // ★ステップ2で設定したオプションと完全に一致させる
        title: 'Test Entry from Script' // 何か適当なテキストフィールドも必要なので追加
    };

    try {
        console.log(`microCMSのテストエンドポイント '${TEST_ENDPOINT}' にデータを送信中...`);
        console.log('送信データ:', testContent);

        const res = await axios.post(
            `${microCMSBaseUrl}/${TEST_ENDPOINT}`,
            testContent,
            {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('microCMSへのテストデータ登録が成功しました！');
        console.log('レスポンス:', res.data);
        return res.data;
    } catch (error) {
        console.error(`microCMSテスト登録エラー (${TEST_ENDPOINT}):`, error.message);
        if (error.response) {
            console.error('microCMS API Error Details:', error.response.data);
            console.error('microCMS API Status:', error.response.status);
            console.error('microCMS API Headers:', error.response.headers);
        } else if (error.request) {
            console.error('microCMS API Request made but no response received:', error.request);
        } else {
            console.error('Error setting up microCMS API test request:', error.message);
        }
        throw error;
    }
}

(async () => {
    console.log('microCMSテストスクリプトを開始します...');
    await sendTestAssetToMicroCMS();
    console.log('microCMSテストスクリプトが完了しました。');
})();