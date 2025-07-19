// your-project-root/api/scenes.mjs
import { createClient } from 'microcms-js-sdk';

const serviceId = process.env.MICROCMS_SERVICE_ID;
const apiKey = process.env.MICROCMS_API_KEY;

// デバッグログはもう不要なので削除するか、コメントアウトしてください
// console.log('--- Environment Variable Actual Values (FOR DEBUGGING - DO NOT EXPOSE IN PRODUCTION) ---');
// console.log('MICROCMS_SERVICE_ID (raw):', serviceId);
// console.log('MICROCMS_API_KEY (raw):', apiKey);
// console.log('---------------------------------------------------------------------------------------');

if (!serviceId || !apiKey) {
  console.error('MicroCMS serviceId または apiKey がVercelの環境変数に設定されていません。');
}

// ★ここを修正しました: serviceId を serviceDomain に変更し、ドメイン形式に変換
const client = createClient({
  serviceDomain: `${serviceId}.microcms.io`,
  apiKey: apiKey,
});

export default async function handler(req, res) {
  // ... 既存の GET および POST のハンドラーロジック ...
  if (req.method === 'GET') {
    const { episode } = req.query; 

    if (!episode) {
      return res.status(400).json({ error: 'Episode parameter is required.' });
    }

    try {
      const data = await client.get({
        endpoint: 'scenes',
        queries: { filters: `episode[equals]${episode}`, limit: 999 },
      });
      return res.status(200).json(data.contents);
    } catch (error) {
      console.error('Error fetching scenes:', error);
      return res.status(500).json({ error: 'Failed to fetch scenes.' });
    }
  }
  else if (req.method === 'POST') {
    try {
      const { episode, ...newSceneData } = req.body;
      console.log('POST request received with data:', req.body);

      if (!episode) {
        return res.status(400).json({ error: 'Episode parameter is required.' });
      }

      const sceneToCreate = {
        episode: parseInt(episode, 10),
        ...newSceneData,
      };

      const createdScene = await client.create({
        endpoint: 'scenes',
        content: sceneToCreate,
      });

      console.log('Scene created successfully:', createdScene);
      return res.status(201).json(createdScene);

    } catch (error) {
      console.error('Error creating scene:', error);
      if (error.response && error.response.data) {
        return res.status(error.response.status || 500).json({
          error: 'Failed to create scene in MicroCMS.',
          details: error.response.data,
        });
      }
      return res.status(500).json({ error: 'Internal server error while creating scene.' });
    }
  }
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}