-// api/media.js
// microCMSの「メディアアップロード」エンドポイントへのプロキシ

import fetch from 'node-fetch';
import { IncomingForm } from 'formidable'; // ファイルアップロードを処理するためのライブラリ
import fs from 'fs';

// formidableの設定 (VercelのServerless Functionの制限に合わせてbodyParseをfalseにする)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function (req, res) {
  const MICROCMS_SERVICE_ID = process.env.MICROCMS_SERVICE_ID;
  const UPLOAD_API_KEY = process.env.MICROCMS_MANAGEMENT_API_KEY; // アップロードには管理APIキーが必要

  if (!MICROCMS_SERVICE_ID || !UPLOAD_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: microCMS environment variables are not set for media upload.' });
  }

  const microCMSUrl = `https://${MICROCMS_SERVICE_ID}.microcms.io/api/v2/media`;

  if (req.method === 'POST') {
    const form = new IncomingForm();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form data:', err);
        return res.status(500).json({ error: 'Error parsing form data.' });
      }

      if (!files.file) { // 'file' は <input type="file" name="file"> の name 属性と一致
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const file = files.file[0]; // formidable 3.xではfiles.fieldnameは配列になる
      if (!file) {
        return res.status(400).json({ error: 'No file found in upload.' });
      }
      
      const fileStream = fs.createReadStream(file.filepath);

      try {
        const microCMSRes = await fetch(microCMSUrl, {
          method: 'POST',
          headers: {
            'X-MICROCMS-API-KEY': UPLOAD_API_KEY,
            // 'Content-Type': 'multipart/form-data' はnode-fetchが自動で設定するため不要
          },
          body: fileStream, // ストリームを直接bodyに渡す
        });

        const data = await microCMSRes.json();
        res.status(microCMSRes.status).json(data);

      } catch (error) {
        console.error('Proxy error for media upload API:', error);
        res.status(500).json({ error: 'Failed to proxy media upload request to microCMS.' });
      } finally {
        // アップロード後に一時ファイルを削除 (formidableが自動で処理することもあるが、念のため)
        // fs.unlink(file.filepath, (unlinkErr) => {
        //   if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        // });
      }
    });
  } else {
    res.status(405).json({ error: 'Method Not Allowed. Only POST is supported for media upload.' });
  }
}
