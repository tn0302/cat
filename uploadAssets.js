<<<<<<< HEAD
require('dotenv').config(); // .envファイルを読み込む

const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cloudinary設定
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// microCMS API設定
const MICROCMS_SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_ID;
const MICROCMS_API_KEY = process.env.MICROCMS_MANAGEMENT_API_KEY; // 管理用APIキー
const ASSETS_ENDPOINT = process.env.MICROCMS_ASSETS_ENDPOINT; // 通常 "assets"

// microCMS APIのベースURL (★ 修正: v1 から v2 に変更)
const microCMSBaseUrl = `https://${MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v2`;

/**
 * ファイルパスからMIMEタイプを推測するヘルパー関数
 * @param {string} filePath
 * @returns {string}
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream'; // 不明な場合は汎用的なもの
    }
}

/**
 * Cloudinaryに画像をアップロードし、そのURLを返す
 * @param {string} filePath - アップロードするローカルファイルのパス
 * @param {string} publicId - Cloudinaryに保存する際のpublic_id (ユニークな識別子、ファイル名など)
 * @returns {Promise<string>} アップロードされた画像のURL
 */
async function uploadToCloudinary(filePath, publicId) {
    try {
        console.log(`Cloudinaryに ${filePath} をアップロード中 (public_id: ${publicId})...`);
        const result = await cloudinary.uploader.upload(filePath, {
            public_id: publicId,
            overwrite: true, // 同じpublic_idがあれば上書き
            resource_type: 'image' // 画像であることを明示
        });
        console.log('Cloudinary URL:', result.secure_url);
        return result.secure_url;
    } catch (error) {
        console.error(`Cloudinaryアップロードエラー (${filePath}):`, error.message);
        throw error;
    }
}

/**
 * microCMSにアセット情報を新規登録する (axiosを使用)
 * (このバージョンでは既存チェック・更新は行いません。常に新規作成です。)
 * @param {object} assetData - 登録するアセット情報
 * @param {string[]} assetData.asset_type - アセットのタイプ ('background', 'character', 'special_image') の配列
 * @param {string} assetData.tag - アセットのユニークなタグ (キャラクター名など)
 * @param {string} assetData.imageUrl - Cloudinaryから取得した画像のURL
 * @param {string} [assetData.character_face_tag] - キャラクターの場合の表情タグ (オプション)
 * @param {string} [assetData.character_special] - キャラクターの場合の特殊タグ (服装など、オプション)
 */
async function registerAssetToMicroCMS(assetData) {
    try {
        let content = {
            asset_type: assetData.asset_type,
            tag: assetData.tag,
            // ★ 修正: image_url を削除し、image フィールドにメディアオブジェクトとしてURLをセット
            image: { url: assetData.imageUrl } 
        };

        // asset_type が配列になったため、includes() で 'character' をチェックする
        if (assetData.asset_type.includes('character')) {
            content.character_face_tag = assetData.character_face_tag || 'default';
            // ★ 削除: character_face_image を削除 (image に一本化するため)
            
            // character_special が存在する場合に設定
            if (assetData.character_special) {
                content.character_special = assetData.character_special;
            }
        } 
        
        console.log(`新規アセット ${assetData.tag} を登録中...`);
        
        const res = await axios.post(
            `${microCMSBaseUrl}/${ASSETS_ENDPOINT}`,
            content,
            {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`microCMSにアセット「${assetData.tag}」を新規登録しました。ID: ${res.data.id}`);
        return res.data;
    } catch (error) {
        console.error(`microCMS登録エラー (${assetData.tag}):`, error.message);
        if (error.response) {
            console.error('microCMS API Error Details:', error.response.data);
            console.error('microCMS API Status:', error.response.status);
            console.error('microCMS API Headers:', error.response.headers);
        } else if (error.request) {
            console.error('microCMS API Request made but no response received:', error.request);
        } else {
            console.error('Error setting up microCMS API request:', error.message);
        }
        throw error;
    }
}

/**
 * メイン関数：アセットのアップロードとmicroCMSへの登録を処理
 * @param {string} filePath - ローカルファイルのパス
 * @param {string} type - アセットのタイプ ('background', 'character', 'special_image', 'effect')
 * @param {string} tag - アセットのユニークなタグ (例: 'forest_day', 'hero', 'flash')
 * @param {string} [faceTag] - キャラクターの場合の表情タグ (オプション、例: 'normal', 'smile')
 * @param {string} [specialTag] - キャラクターの場合の特殊タグ (オプション、例: 'winter_clothes')
 */
async function processAsset(filePath, type, tag, faceTag = null, specialTag = null) {
    // Cloudinaryのpublic_idを生成。フォルダ構造を持つようにすると管理しやすい。
    // public_idには specialTag も含めるようにすると、ユニーク性が高まり管理しやすい
    const publicId = `${type}/${tag}${faceTag ? '_' + faceTag : ''}${specialTag ? '_' + specialTag : ''}`; 
    
    try {
        const cloudinaryUrl = await uploadToCloudinary(filePath, publicId);
        
        let microcmsAssetTag = tag;
        let characterFaceTagForMicroCMS = faceTag;
        let characterSpecialForMicroCMS = specialTag;

        // キャラクタータイプでfaceTagが指定されていない場合、ファイル名から推測を試みる
        if (type === 'character' && !faceTag) {
            const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
            const parts = fileNameWithoutExt.split('_');
            if (parts.length > 1) {
                microcmsAssetTag = parts[0]; 
                characterFaceTagForMicroCMS = parts.slice(1).join('_'); 
            } else {
                characterFaceTagForMicroCMS = 'default'; 
            }
        }
        
        await registerAssetToMicroCMS({
            asset_type: [type], // 配列形式で渡す
            tag: microcmsAssetTag,
            imageUrl: cloudinaryUrl, // CloudinaryのURL
            character_face_tag: characterFaceTagForMicroCMS,
            character_special: characterSpecialForMicroCMS,
        });
        console.log(`アセット ${filePath} の処理が完了しました。`);
    } catch (error) {
        console.error(`アセット ${filePath} の処理中にエラーが発生しました:`, error.message);
    }
}

// --- 使用例 ---
// ここにアップロードしたいアセットの情報を記述して実行します。

(async () => {
    console.log('アセットアップロードスクリプトを開始します...');

    // 例1: キャラクター画像 '1000008383.png' (通常服、怒り顔) をアップロード
    await processAsset(
        './assets_to_upload/characters/1000008383.png', 
        'character',                                   
        'chiharu',                                     
        'angry',                                       
        null                                           
    );

    // 例2: キャラクター画像 'chiharu_smile_winter.png' (冬服、笑顔) をアップロード
    await processAsset(
        './assets_to_upload/characters/chiharu_smile_winter.png', 
        'character',                                             
        'chiharu',                                               
        'smile',                                                 
        'winter'                                                 
    );

    // 例3: 背景画像をアップロードする場合の例
    await processAsset(
        './assets_to_upload/backgrounds/forest_day.png', 
        'background',                                    
        'forest_day'                                     
    );

    // 例4: エフェクト画像をアップロードする場合の例
    await processAsset(
        './assets_to_upload/effects/flash_effect.png',   
        'effect',                                        
        'flash'                                          
    );

    // 例5: 特殊画像をアップロードする場合の例
    await processAsset(
        './assets_to_upload/special_images/scene_end.png', 
        'special_image',                                 
        'scene_end'                                      
    );

    console.log('アセットアップロードスクリプトが完了しました。');
=======
require('dotenv').config(); // .envファイルを読み込む

const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Cloudinary設定
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// microCMS API設定
const MICROCMS_SERVICE_DOMAIN = process.env.MICROCMS_SERVICE_ID;
const MICROCMS_API_KEY = process.env.MICROCMS_MANAGEMENT_API_KEY; // 管理用APIキー
const ASSETS_ENDPOINT = process.env.MICROCMS_ASSETS_ENDPOINT; // 通常 "assets"

// microCMS APIのベースURL (★ 修正: v1 から v2 に変更)
const microCMSBaseUrl = `https://${MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v2`;

/**
 * ファイルパスからMIMEタイプを推測するヘルパー関数
 * @param {string} filePath
 * @returns {string}
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream'; // 不明な場合は汎用的なもの
    }
}

/**
 * Cloudinaryに画像をアップロードし、そのURLを返す
 * @param {string} filePath - アップロードするローカルファイルのパス
 * @param {string} publicId - Cloudinaryに保存する際のpublic_id (ユニークな識別子、ファイル名など)
 * @returns {Promise<string>} アップロードされた画像のURL
 */
async function uploadToCloudinary(filePath, publicId) {
    try {
        console.log(`Cloudinaryに ${filePath} をアップロード中 (public_id: ${publicId})...`);
        const result = await cloudinary.uploader.upload(filePath, {
            public_id: publicId,
            overwrite: true, // 同じpublic_idがあれば上書き
            resource_type: 'image' // 画像であることを明示
        });
        console.log('Cloudinary URL:', result.secure_url);
        return result.secure_url;
    } catch (error) {
        console.error(`Cloudinaryアップロードエラー (${filePath}):`, error.message);
        throw error;
    }
}

/**
 * microCMSにアセット情報を新規登録する (axiosを使用)
 * (このバージョンでは既存チェック・更新は行いません。常に新規作成です。)
 * @param {object} assetData - 登録するアセット情報
 * @param {string[]} assetData.asset_type - アセットのタイプ ('background', 'character', 'special_image') の配列
 * @param {string} assetData.tag - アセットのユニークなタグ (キャラクター名など)
 * @param {string} assetData.imageUrl - Cloudinaryから取得した画像のURL
 * @param {string} [assetData.character_face_tag] - キャラクターの場合の表情タグ (オプション)
 * @param {string} [assetData.character_special] - キャラクターの場合の特殊タグ (服装など、オプション)
 */
async function registerAssetToMicroCMS(assetData) {
    try {
        let content = {
            asset_type: assetData.asset_type,
            tag: assetData.tag,
            // ★ 修正: image_url を削除し、image フィールドにメディアオブジェクトとしてURLをセット
            image: { url: assetData.imageUrl } 
        };

        // asset_type が配列になったため、includes() で 'character' をチェックする
        if (assetData.asset_type.includes('character')) {
            content.character_face_tag = assetData.character_face_tag || 'default';
            // ★ 削除: character_face_image を削除 (image に一本化するため)
            
            // character_special が存在する場合に設定
            if (assetData.character_special) {
                content.character_special = assetData.character_special;
            }
        } 
        
        console.log(`新規アセット ${assetData.tag} を登録中...`);
        
        const res = await axios.post(
            `${microCMSBaseUrl}/${ASSETS_ENDPOINT}`,
            content,
            {
                headers: {
                    'X-MICROCMS-API-KEY': MICROCMS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`microCMSにアセット「${assetData.tag}」を新規登録しました。ID: ${res.data.id}`);
        return res.data;
    } catch (error) {
        console.error(`microCMS登録エラー (${assetData.tag}):`, error.message);
        if (error.response) {
            console.error('microCMS API Error Details:', error.response.data);
            console.error('microCMS API Status:', error.response.status);
            console.error('microCMS API Headers:', error.response.headers);
        } else if (error.request) {
            console.error('microCMS API Request made but no response received:', error.request);
        } else {
            console.error('Error setting up microCMS API request:', error.message);
        }
        throw error;
    }
}

/**
 * メイン関数：アセットのアップロードとmicroCMSへの登録を処理
 * @param {string} filePath - ローカルファイルのパス
 * @param {string} type - アセットのタイプ ('background', 'character', 'special_image', 'effect')
 * @param {string} tag - アセットのユニークなタグ (例: 'forest_day', 'hero', 'flash')
 * @param {string} [faceTag] - キャラクターの場合の表情タグ (オプション、例: 'normal', 'smile')
 * @param {string} [specialTag] - キャラクターの場合の特殊タグ (オプション、例: 'winter_clothes')
 */
async function processAsset(filePath, type, tag, faceTag = null, specialTag = null) {
    // Cloudinaryのpublic_idを生成。フォルダ構造を持つようにすると管理しやすい。
    // public_idには specialTag も含めるようにすると、ユニーク性が高まり管理しやすい
    const publicId = `${type}/${tag}${faceTag ? '_' + faceTag : ''}${specialTag ? '_' + specialTag : ''}`; 
    
    try {
        const cloudinaryUrl = await uploadToCloudinary(filePath, publicId);
        
        let microcmsAssetTag = tag;
        let characterFaceTagForMicroCMS = faceTag;
        let characterSpecialForMicroCMS = specialTag;

        // キャラクタータイプでfaceTagが指定されていない場合、ファイル名から推測を試みる
        if (type === 'character' && !faceTag) {
            const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
            const parts = fileNameWithoutExt.split('_');
            if (parts.length > 1) {
                microcmsAssetTag = parts[0]; 
                characterFaceTagForMicroCMS = parts.slice(1).join('_'); 
            } else {
                characterFaceTagForMicroCMS = 'default'; 
            }
        }
        
        await registerAssetToMicroCMS({
            asset_type: [type], // 配列形式で渡す
            tag: microcmsAssetTag,
            imageUrl: cloudinaryUrl, // CloudinaryのURL
            character_face_tag: characterFaceTagForMicroCMS,
            character_special: characterSpecialForMicroCMS,
        });
        console.log(`アセット ${filePath} の処理が完了しました。`);
    } catch (error) {
        console.error(`アセット ${filePath} の処理中にエラーが発生しました:`, error.message);
    }
}

// --- 使用例 ---
// ここにアップロードしたいアセットの情報を記述して実行します。

(async () => {
    console.log('アセットアップロードスクリプトを開始します...');

    // 例1: キャラクター画像 '1000008383.png' (通常服、怒り顔) をアップロード
    await processAsset(
        './assets_to_upload/characters/1000008383.png', 
        'character',                                   
        'chiharu',                                     
        'angry',                                       
        null                                           
    );

    // 例2: キャラクター画像 'chiharu_smile_winter.png' (冬服、笑顔) をアップロード
    await processAsset(
        './assets_to_upload/characters/chiharu_smile_winter.png', 
        'character',                                             
        'chiharu',                                               
        'smile',                                                 
        'winter'                                                 
    );

    // 例3: 背景画像をアップロードする場合の例
    await processAsset(
        './assets_to_upload/backgrounds/forest_day.png', 
        'background',                                    
        'forest_day'                                     
    );

    // 例4: エフェクト画像をアップロードする場合の例
    await processAsset(
        './assets_to_upload/effects/flash_effect.png',   
        'effect',                                        
        'flash'                                          
    );

    // 例5: 特殊画像をアップロードする場合の例
    await processAsset(
        './assets_to_upload/special_images/scene_end.png', 
        'special_image',                                 
        'scene_end'                                      
    );

    console.log('アセットアップロードスクリプトが完了しました。');
>>>>>>> 24c00192689d7d55e55165b41059b3bc7eb04038
})();