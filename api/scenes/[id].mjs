// your-project-root/api/scenes/[id].mjs
import { createClient } from 'microcms-js-sdk';

// 環境変数からAPIキーと、BASE_URL（サービスIDを含む）を取得
// これらの変数はトップレベルで定義されますが、チェックとエラー応答はhandler関数内で行います
const microcmsApiBaseUrl = process.env.MICROCMS_API_BASE_URL;
const apiKey = process.env.MICROCMS_API_KEY;

// microCMSクライアントは一度だけ初期化します
let client;
let serviceDomain = '';

// handler関数が初めて呼び出されたときにクライアントを初期化するように変更
// または、トップレベルでtry-catchを使って初期化
try {
    // MICROCMS_API_BASE_URL が設定されていない場合は、後のhandler関数内でエラーを返す
    if (microcmsApiBaseUrl) {
        // serviceDomain を MICROCMS_API_BASE_URL から抽出
        const url = new URL(`https://${microcmsApiBaseUrl}`); // 仮にhttpsを付けてパース
        serviceDomain = url.host;

        if (!serviceDomain.includes('.microcms.io')) {
            // 不正な形式の場合もエラーを投げてクライアント初期化を阻止
            throw new Error('Invalid MICROCMS_API_BASE_URL format for serviceDomain.');
        }

        // 全てが正しければクライアントを初期化
        client = createClient({
            serviceDomain: serviceDomain,
            apiKey: apiKey,
        });
    }
} catch (e) {
    console.error('MicroCMS client initialization failed at top level:', e.message);
    // 初期化に失敗した場合、clientはundefinedのままにしておく
    client = null; // 明示的にnullを設定
}


export default async function handler(req, res) {
  console.log('--- api/scenes/[id].mjs handler started ---');
  console.log('Request method:', req.method);

  // 環境変数とクライアント初期化のチェックをhandler関数内で行う
  if (!microcmsApiBaseUrl || !apiKey || !client) {
      console.error('Server configuration error: MicroCMS environment variables are not set or client initialization failed.');
      return res.status(500).json({ error: 'Server configuration error: MicroCMS variables are missing or invalid, or client failed to initialize.' });
  }

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