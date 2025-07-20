// your-project-root/api/scenes/[id].mjs
import { createClient } from 'microcms-js-sdk';

// 環境変数からAPIキーと、BASE_URL（サービスIDを含む）を取得
// MICROCMS_API_BASE_URL は "your-service-id.microcms.io/api/v1" の形式で設定されていると仮定
const microcmsApiBaseUrl = process.env.MICROCMS_API_BASE_URL;
const apiKey = process.env.MICROCMS_API_KEY;

// 環境変数が正しく設定されていない場合の早期リターン
if (!microcmsApiBaseUrl || !apiKey) {
  console.error('MicroCMS environment variables (MICROCMS_API_BASE_URL or MICROCMS_API_KEY) are not set.');
  return res.status(500).json({ error: 'Server configuration error: MicroCMS environment variables are not set.' });
}

// microcms-js-sdk の serviceDomain には "your-service-id.microcms.io" の形式が必要
// MICROCMS_API_BASE_URL からドメイン部分を抽出します
let serviceDomain = '';
try {
  // "https://your-service-id.microcms.io/api/v1" から "your-service-id.microcms.io" を取得
  // 'https://' プレフィックスを考慮して、URLオブジェクトを使うのが最も安全です
  const url = new URL(`https://${microcmsApiBaseUrl}`); // 仮にhttpsを付けてパース
  serviceDomain = url.host; // ホスト名のみを取得 (例: "your-service-id.microcms.io")

  if (!serviceDomain.includes('.microcms.io')) {
      throw new Error('Invalid MICROCMS_API_BASE_URL format. Expected "your-service-id.microcms.io/api/v1".');
  }
} catch (e) {
  console.error('Error parsing MICROCMS_API_BASE_URL for serviceDomain:', e.message);
  return res.status(500).json({ error: 'Failed to parse MICROCMS_API_BASE_URL for serviceDomain. Check environment variable format.' });
}

const client = createClient({
  serviceDomain: serviceDomain, // 抽出した正しいドメインを使用
  apiKey: apiKey,
});

export default async function handler(req, res) {
  console.log('--- api/scenes/[id].mjs handler started ---');
  console.log('Request method:', req.method);

  // [id].mjs の場合、IDは req.query.id で取得されます
  const { id } = req.query;
  console.log('Scene ID from query:', id);

  if (req.method === 'PATCH') {
    try {
      const requestBody = req.body;
      console.log('PATCH request body:', requestBody);

      if (!id) {
        console.warn('Error: Scene ID is required but not found in query.');
        return res.status(400).json({ error: 'Scene ID is required.' });
      }
      if (!requestBody || Object.keys(requestBody).length === 0) {
        console.warn('Error: Request body is empty for PATCH.');
        return res.status(400).json({ error: 'Request body cannot be empty for PATCH.' });
      }

      console.log('Attempting to update scene in MicroCMS...');
      const updatedScene = await client.update({
        endpoint: 'scenes', // シーンのエンドポイント名
        contentId: id,
        content: requestBody,
      });

      console.log('Scene updated successfully:', updatedScene);
      return res.status(200).json(updatedScene);

    } catch (error) {
      console.error('Error in PATCH handler:', error);
      if (error.response && error.response.data) {
        console.error('MicroCMS error response details:', error.response.data);
        return res.status(error.response.status || 500).json({
          error: 'Failed to update scene in MicroCMS.',
          details: error.response.data,
        });
      }
      // fetch failed のようなネットワークエラーの場合、detailsにエラーメッセージを渡す
      return res.status(500).json({ error: 'Internal server error while updating scene.', details: error.message });
    }
  } else {
    // PATCH以外のメソッドは現状サポートしない
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}