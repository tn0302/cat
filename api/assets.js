// your-project-root/api/assets.js
// microCMSの「アセット」エンドポイントへのプロキシ (GETとPOSTに対応)

export default async function (req, res) {
  const MICROCMS_API_BASE_URL_FULL = process.env.MICROCMS_API_BASE_URL; // 例: "nvw9sy9y9b.microcms.io/api/v1"
  const MICROCMS_API_KEY = process.env.MICROCMS_API_KEY;

  let MICROCMS_SERVICE_ID_ONLY = '';
  if (MICROCMS_API_BASE_URL_FULL) {
    try {
      const urlObj = new URL(`https://${MICROCMS_API_BASE_URL_FULL}`);
      const host = urlObj.host;
      MICROCMS_SERVICE_ID_ONLY = host.split('.')[0];
    } catch (e) {
      console.error('Error parsing MICROCMS_API_BASE_URL_FULL for service ID:', e.message);
    }
  }

  if (!MICROCMS_API_BASE_URL_FULL || !MICROCMS_API_KEY || !MICROCMS_SERVICE_ID_ONLY) {
    console.error('MicroCMS環境変数が未設定または不正です');
    return res.status(500).json({ error: 'MicroCMS環境変数が未設定または不正です' });
  }

  const baseApiUrl = `https://${MICROCMS_SERVICE_ID_ONLY}.microcms.io/api/v1/assets`;

  // ------------------------
  // GETメソッド: アセット取得
  // ------------------------
  if (req.method === 'GET') {
    const { filters } = req.query;
    const url = new URL(baseApiUrl);
    url.searchParams.append('limit', 100);
    if (filters) {
      url.searchParams.append('filters', filters);
    }

    try {
      const microCMSRes = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
        },
      });

      if (!microCMSRes.ok) {
        const errorText = await microCMSRes.text();
        return res.status(microCMSRes.status).json({ error: microCMSRes.statusText, details: errorText });
      }

      const data = await microCMSRes.json();
      return res.status(200).json(data.contents);
    } catch (error) {
      return res.status(500).json({ error: 'アセット取得に失敗しました', details: error.message });
    }
  }

  // ------------------------
  // POSTメソッド: アセット登録
  // ------------------------
  if (req.method === 'POST') {
    try {
      const { asset_type, tag, character_face_tag, character_special, image } = req.body;

      if (!asset_type || !tag || !image) {
        return res.status(400).json({ error: '必要なフィールド（asset_type, tag, image）が不足しています。' });
      }

      // microCMSに送るデータを構成（型やフィールド名に注意）
      const payload = {
        asset_type, // 文字列で渡す (例: "character")
        tag,
        image,      // 文字列URL（例: "https://res.cloudinary.com/...jpg"）
      };

      // 任意項目を追加
      if (character_face_tag) payload.character_face_tag = character_face_tag;
      if (character_special) payload.character_special = character_special;

      const microCMSRes = await fetch(baseApiUrl, {
        method: 'POST',
        headers: {
          'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!microCMSRes.ok) {
        const errorText = await microCMSRes.text();
        console.error('microCMS POST error:', errorText);
        return res.status(microCMSRes.status).json({ error: 'microCMSへの登録に失敗しました', details: errorText });
      }

      const result = await microCMSRes.json();
      return res.status(200).json(result);

    } catch (error) {
      console.error('POSTエラー:', error);
      return res.status(500).json({ error: 'アセット登録時のサーバーエラー', details: error.message });
    }
  }

  // ------------------------
  // その他のメソッドは拒否
  // ------------------------
  return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
}
