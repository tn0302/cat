// your-project-root/api/scenes.mjs

// microcms-js-sdk は不要になるため、この行は削除またはコメントアウトしてください
// import { createClient } from 'microcms-js-sdk';

const serviceId = process.env.MICROCMS_SERVICE_ID;
const apiKey = process.env.MICROCMS_API_KEY;

if (!serviceId || !apiKey) {
  console.error('MicroCMS serviceId または apiKey がVercelの環境変数に設定されていません。');
  // エラーハンドリングを強化する場合は、ここで早期リターンしても良いでしょう
}

export default async function handler(req, res) {
  // MicroCMSのAPIエンドポイントのベースURLを構築
  const baseUrl = `https://${serviceId}.microcms.io/api/v1/scenes`;

  // GET リクエスト（シーンの取得）の処理
  if (req.method === 'GET') {
    const { episode } = req.query; // GETリクエストではクエリパラメータからepisodeを取得

    if (!episode) {
      return res.status(400).json({ error: 'Episode parameter is required.' });
    }

    // クエリパラメータを追加して完全なURLを構築
    const url = new URL(baseUrl);
    url.searchParams.append('filters', `episode[equals]${episode}`);
    url.searchParams.append('limit', '999'); // 取得制限数を設定

    console.log(`Fetching scenes from: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-MICROCMS-API-KEY': apiKey, // APIキーをヘッダーに設定
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MicroCMS GET API returned non-OK status: ${response.status}, ${response.statusText}`);
        console.error('MicroCMS error response body:', errorText);
        return res.status(response.status).json({ error: response.statusText, details: errorText });
      }

      const data = await response.json();
      // MicroCMSのAPIは { contents: [...], totalCount: N } 形式で返すため、contents配列のみを返す
      return res.status(200).json(data.contents);

    } catch (error) {
      console.error('Error fetching scenes:', error);
      return res.status(500).json({ error: 'Failed to fetch scenes.', details: error.message });
    }
  }
  // POST リクエスト（新しいシーンの作成）の処理
  else if (req.method === 'POST') {
    try {
      const { episode, ...newSceneData } = req.body; // POSTリクエストではリクエストボディからデータを取得
      console.log('POST request received with data:', req.body);

      if (!episode) {
        return res.status(400).json({ error: 'Episode parameter is required.' });
      }

      const sceneToCreate = {
        episode: parseInt(episode, 10), // MicroCMSが数値型を期待する場合、数値に変換
        ...newSceneData,
      };

      const response = await fetch(baseUrl, { // POSTはIDなしのベースURLに送る
        method: 'POST',
        headers: {
          'X-MICROCMS-API-KEY': apiKey,
          'Content-Type': 'application/json', // JSONボディを送信する場合は必須
        },
        body: JSON.stringify(sceneToCreate), // オブジェクトをJSON文字列に変換
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`MicroCMS POST API returned non-OK status: ${response.status}, ${response.statusText}`);
        console.error('MicroCMS error response body:', errorText);
        return res.status(response.status).json({ error: response.statusText, details: errorText });
      }

      const createdScene = await response.json();
      console.log('Scene created successfully:', createdScene);
      return res.status(201).json(createdScene); // 201 Created

    } catch (error) {
      console.error('Error creating scene:', error);
      return res.status(500).json({ error: 'Internal server error while creating scene.', details: error.message });
    }
  }
  // GET および POST 以外のHTTPメソッドが来た場合はエラーを返す
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}