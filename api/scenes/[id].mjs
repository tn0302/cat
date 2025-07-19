// your-project-root/api/scenes/[id].mjs
import { createClient } from 'microcms-js-sdk';

// 環境変数を直接ログ出力して、ランタイムでの値を確認
const serviceId = process.env.MICROCMS_SERVICE_ID;
const apiKey = process.env.MICROCMS_API_KEY;

console.log('--- Environment Variable Check ---'); // 新しいログ
console.log('MICROCMS_SERVICE_ID:', serviceId ? '****** (set)' : 'UNDEFINED/EMPTY'); // 値を直接表示しないが、セットされているか確認
console.log('MICROCMS_API_KEY:', apiKey ? '****** (set)' : 'UNDEFINED/EMPTY'); // 値を直接表示しないが、セットされているか確認
console.log('---------------------------------'); // 新しいログ

if (!serviceId || !apiKey) {
  console.error('MicroCMS serviceId または apiKey がVercelの環境変数に設定されていません。');
  // ここでリクエストを終了させないことで、createClientの後のエラーメッセージを見やすくします。
  // ただし、この場合も createClient は失敗します。
}

const client = createClient({
  serviceId: serviceId,
  apiKey: apiKey,
});

export default async function handler(req, res) {
  console.log('--- api/scenes/[id].mjs handler started ---');
  console.log('Request method:', req.method);

  const { id } = req.query;
  console.log('Scene ID from query:', id);

  if (req.method === 'PATCH') {
    try {
      const requestBody = req.body;
      console.log('PATCH request body:', requestBody);

      if (!id) {
        console.warn('Error: Scene ID is required but not found.');
        return res.status(400).json({ error: 'Scene ID is required.' });
      }
      if (!requestBody || Object.keys(requestBody).length === 0) {
        console.warn('Error: Request body is empty for PATCH.');
        return res.status(400).json({ error: 'Request body cannot be empty for PATCH.' });
      }

      console.log('Attempting to update scene in MicroCMS...');
      const updatedScene = await client.update({
        endpoint: 'scenes',
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
      return res.status(500).json({ error: 'Internal server error while updating scene.' });
    }
  } else {
    res.setHeader('Allow', ['PATCH']);
    console.warn(`Method ${req.method} Not Allowed for this endpoint.`);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}