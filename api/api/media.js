// api/media.js
// Cloudinaryへの画像アップロードを処理するプロキシ

import { IncomingForm } from 'formidable';
import { v2 as cloudinary } from 'cloudinary'; // Cloudinary SDKをインポート
import fs from 'fs';

// formidableの設定 (ファイルアップロードのbody解析を無効にする)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function (req, res) {
  // Cloudinaryの環境変数をVercelから取得
  const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
  const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(500).json({ error: 'Server configuration error: Cloudinary environment variables are not set.' });
  }

  // Cloudinaryの設定
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

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
      
      const filePath = file.filepath; // formidableが一時保存したファイルのパス

      try {
        // Cloudinaryにアップロード
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'novel-game-assets', // Cloudinaryに保存するフォルダ名を指定
            resource_type: 'auto' // 画像、動画、Rawファイルなどを自動判別
        });

        // アップロード成功後の一時ファイルを削除 (formidableが自動で処理することもあるが、念のため)
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
        });

        // クライアントにCloudinaryのURLを返す
        res.status(200).json({ url: result.secure_url });

      } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ error: `Failed to upload to Cloudinary: ${error.message}` });
      }
    });
  } else {
    res.status(405).json({ error: 'Method Not Allowed. Only POST is supported for media upload.' });
  }
}
