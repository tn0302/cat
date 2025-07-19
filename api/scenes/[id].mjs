// your-project-root/api/scenes/[id].mjs
// MicroCMS SDKをインポート
import { createClient } from 'microcms-js-sdk';

// ==========================================================
// MicroCMSのサービスIDとAPIキーはVercelの環境変数に設定してください
// Settings > Environment Variables で追加します
// 例:
// 名前: MICROCMS_SERVICE_ID, 値: YOUR_MICROCMS_SERVICE_ID
// 名前: MICROCMS_API_KEY, 値: YOUR_MICROCMS_API_KEY
// ==========================================================
const serviceId = process.env.MICROCMS_SERVICE_ID;
const apiKey = process.env.MICROCMS_API_KEY;

// 環境変数が設定されているかチェック (デバッグ用)
if (!serviceId || !apiKey) {
  console.error('MicroCMS serviceId または apiKey がVercelの環境変数に設定されていません。');
  // 本番環境では、セキュリティのため、このエラーメッセージをユーザーに直接表示しないように注意してください。
}

// MicroCMSクライアントの初期化
const client = createClient({
  serviceId: serviceId,
  apiKey: apiKey,
});

// Vercelのサーバーレス関数のエントリポイント
export default async function handler(req, res) {
  // URLパスからダイナミックルートのID（シーンID）を取得
  const { id } = req.query;

  // PATCHメソッドのリクエストのみを処理
  if (req.method === 'PATCH') {
    try {
      // リクエストボディから更新データ（セリフなど）を取得
      // フロントエンドからはJSON形式でデータが送信される想定
      const requestBody = req.body;
      console.log(`PATCH request received for scene ID: ${id}`);
      console.log('Request body:', requestBody);

      // IDまたはボディが空の場合はエラーを返す
      if (!id) {
        return res.status(400).json({ error: 'シーンIDがURLパスに含まれていません。' });
      }
      if (!requestBody || Object.keys(requestBody).length === 0) {
        return res.status(400).json({ error: '更新データがリクエストボディに含まれていません。' });
      }

      // MicroCMSのupdateメソッドを呼び出してシーンを更新
      // endpoint: MicroCMSで作成したコンテンツのAPIエンドポイント名 (例: 'scenes')
      // contentId: 更新対象のコンテンツのID
      // content: 更新したいフィールドとその値を含むオブジェクト
      const updatedScene = await client.update({
        endpoint: 'scenes', // ここはMicroCMSのAPIエンドポイント名に合わせてください
        contentId: id,
        content: requestBody, // 例: { text: "新しいセリフ" }
      });

      console.log('Scene updated successfully:', updatedScene);
      // 更新成功後、更新されたシーンデータをJSON形式で返す
      return res.status(200).json(updatedScene);

    } catch (error) {
      console.error('シーンの更新中にエラーが発生しました:', error);

      // MicroCMS APIからの詳細なエラーレスポンスがあればそれを返す
      if (error.response && error.response.data) {
        return res.status(error.response.status || 500).json({
          error: 'MicroCMSでのシーン更新に失敗しました。',
          details: error.response.data,
        });
      }
      // それ以外の内部エラーの場合
      return res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
    }
  } else {
    // PATCH以外のHTTPメソッド（例: GET, POSTなど）が来た場合はエラーを返す
    res.setHeader('Allow', ['PATCH']); // 許可するメソッドをヘッダーに設定
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}