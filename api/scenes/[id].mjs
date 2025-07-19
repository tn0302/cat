// your-project-root/api/scenes/[id].mjs
import { createClient } from 'microcms-js-sdk';

const serviceId = process.env.MICROCMS_SERVICE_ID;
const apiKey = process.env.MICROCMS_API_KEY;

if (!serviceId || !apiKey) {
  console.error('MicroCMS serviceId または apiKey がVercelの環境変数に設定されていません。');
}

const client = createClient({
  serviceId: serviceId,
  apiKey: apiKey,
});

export default async function handler(req, res) {
  console.log('--- api/scenes/[id].mjs handler started ---'); // ハンドラー開始ログ
  console.log('Request method:', req.method);

  const { id } = req.query; // URLからIDを取得
  console.log('Scene ID from query:', id); // 取得したIDをログ出力

  if (req.method === 'PATCH') {
    try {
      const requestBody = req.body;
      console.log('PATCH request body:', requestBody); // リクエストボディをログ出力

      if (!id) {
        console.warn('Error: Scene ID is required but not found.'); // IDがない場合のログ
        return res.status(400).json({ error: 'Scene ID is required.' });
      }
      if (!requestBody || Object.keys(requestBody).length === 0) {
        console.warn('Error: Request body is empty for PATCH.'); // ボディが空の場合のログ
        return res.status(400).json({ error: 'Request body cannot be empty for PATCH.' });
      }

      console.log('Attempting to update scene in MicroCMS...'); // MicroCMS更新前のログ
      const updatedScene = await client.update({
        endpoint: 'scenes',
        contentId: id,
        content: requestBody,
      });

      console.log('Scene updated successfully:', updatedScene); // 更新成功のログ
      return res.status(200).json(updatedScene);

    } catch (error) {
      console.error('Error in PATCH handler:', error); // エラー発生時の詳細ログ
      // MicroCMS APIからのエラーレスポンスがあればそれをログ出力
      if (error.response && error.response.data) {
        console.error('MicroCMS error response details:', error.response.data);
        return res.status(error.response.status || 500).json({
          error: 'Failed to update scene in MicroCMS.',
          details: error.response.data,
        });
      }
      return res.status(500).json({ error: 'Internal server error while updating scene.' });
    }
  } else {
    res.setHeader('Allow', ['PATCH']);
    console.warn(`Method ${req.method} Not Allowed for this endpoint.`); // 不許可メソッドのログ
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}