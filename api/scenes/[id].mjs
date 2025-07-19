// your-project-root/api/scenes/[id].mjs

// microcms-js-sdk は不要になるため、この行は削除またはコメントアウトしてください
// import { createClient } from 'microcms-js-sdk';

const serviceId = process.env.MICROCMS_SERVICE_ID;
const apiKey = process.env.MICROCMS_API_KEY;

if (!serviceId || !apiKey) {
  console.error('MicroCMS serviceId または apiKey がVercelの環境変数に設定されていません。');
}

export default async function handler(req, res) {
  const { id } = req.query; // URLからIDを取得
  // MicroCMSの特定のコンテンツIDへのAPIエンドポイントURLを構築
  const url = `https://${serviceId}.microcms.io/api/v1/scenes/${id}`;

  if (req.method === 'PATCH') {
    try {
      const requestBody = req.body;
      console.log('PATCH request body:', requestBody);

      if (!id) {
        return res.status(400).json({ error: 'Scene ID is required.' });
      }
      if (!requestBody || Object.keys(requestBody).length === 0) {
        return res.status(400).json({ error: 'Request body cannot be empty for PATCH.' });
      }

      console.log('Attempting to update scene in MicroCMS...');

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'X-MICROCMS-API-KEY': apiKey,
          'Content-Type': 'application/json', // JSONボディを送信する場合は必須
        },
        body: JSON.stringify(requestBody), // オブジェクトをJSON文字列に変換
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MicroCMS PATCH API returned non-OK status: ${response.status}, ${response.statusText}`);
        console.error('MicroCMS error response body:', errorText);
        return res.status(response.status).json({ error: response.statusText, details: errorText });
      }

      const updatedScene = await response.json();
      console.log('Scene updated successfully:', updatedScene);
      return res.status(200).json(updatedScene);

    } catch (error) {
      console.error('Error in PATCH handler:', error);
      return res.status(500).json({ error: 'Internal server error while updating scene.', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}