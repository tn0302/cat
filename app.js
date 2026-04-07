/**
 * [app.js] 勇者ハーレム - ファンタジービューア ロジック
 * * 1. ⚙️ 設定・API設定 (Supabase, Config)
 * 2. 📦 状態管理 (state, Global variables)
 * 3. 🏗️ UIキャッシュ (DOM Elements)
 * 4. 🚀 初期化処理 (initialize, window.onload)
 * 5. 📖 描画コアロジック (renderScene, updateImage, HUD)
 * 6. 📥 データ取得・加工 (loadEpisodeData, fetchAssets)
 * 7. 🖱️ インタラクション (クリック, スワイプ, オート)
 * 8. ✍️ インライン編集ロジック (Edit mode, Save)
 * 9. 🗂️ エピソード・モーダル管理 (Episode Dial, Modal)
 * 10. 🛠️ ユーティリティ (Loading, Progress)
 */

// --- 1. ⚙️ 設定・API設定 ---
    // ※ プロジェクトの設定画面 (Settings > API) からコピーした値を貼り付けてください
    const SUPABASE_URL = 'https://sluvdcvxtzlpbqrxfpsg.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_dXIvPQtvu-2PunZ1FNkzyA_yczzig09'; 
    // 変数名を supabaseClient ではなく supabase にする
    // ライブラリの supabase と区別するため、変数名を変更します
// 変数名を supabaseClient にして重複を避ける
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const CONFIG = {
        PRELOAD_COUNT: 5,       // 先読み数
        STORAGE_KEY: 'novel_viewer_save'
    };

// --- 2. 📦 状態管理 ---
let globalLastBackground = "";

let state = {
        tempEditData: null,
        episodeData: [],
        sceneIndex: 0,
        isAuto: false,
        autoTimer: null,
        episodeNumbers: [],
        allEpisodes: [], // ★ これを追加
        currentEpisodeId: null,
        loadedAssets: { bg: {}, char: {}, special: {}, effect: {} },
        modalMode: '',
        isInlineEditing: false,
        lastBackgroundTag: "" 
    };
    
// --- 3. 🏗️ UIキャッシュ ---
const ui = {
    // 基本UI
    text: document.getElementById('dialogue-text'),
    name: document.getElementById('character-name'),
    charImg: document.getElementById('character'),
    bgDiv: document.getElementById('background'),
    specialImg: document.getElementById('special'), // ここが 'special' になっていること
    effectImg: document.getElementById('effect'),
    container: document.getElementById('novel-container'),
    loading: document.getElementById('loading-indicator'),
    epSelect: document.getElementById('episode-select'),
    dialogueBox: document.getElementById('dialogue-box'),
    modal: document.getElementById('modal'),

    // インライン編集（イマーシブ）
   displayArea: document.getElementById('display-area'), // 追加推奨：表示エリアの切替用
    inlineEditor: document.getElementById('inline-editor'),
    inlineEditForm: document.getElementById('inline-edit-form'),
    inlineEditName: document.getElementById('inline-edit-name'),
    inlineEditFace: document.getElementById('inline-edit-face'),
    inlineEditTextarea: document.getElementById('inline-edit-textarea'),
    inlineSaveBtn: document.getElementById('inline-save-btn'),
    inlineEditBtn: document.getElementById('inline-edit-btn'),
    inlineCancelBtn: document.getElementById('inline-cancel-btn'),
    
// ★タブ化に伴い追加が必要な「背景・演出」タブの入力欄
    inlineEditBg: document.getElementById('inline-edit-bg'),
    inlineEditSpecial: document.getElementById('inline-edit-special'),
    inlineEditEffect: document.getElementById('inline-edit-effect'),

    inlineSaveBtn: document.getElementById('inline-save-btn'),
    inlineCancelBtn: document.getElementById('inline-cancel-btn'),

    // イマーシブ内の追加・削除ボタン
    inlineAddBtn: document.getElementById('inline-add-btn'),
    inlineDeleteBtn: document.getElementById('inline-delete-btn')
};

// --- 4. 🚀 初期化処理 ---
window.onload = initialize;

async function initialize() {
        try {
            // 🌟 1. まず最初に「アセット（画像URL辞書）」を構築する 🌟
            // これがないと、あとの loadEpisodeData で画像URLが空になります
            const { data: assets, error: assetError } = await supabaseClient
                .from('assets')
                .select('*');

            if (assetError) throw assetError;

            // 取得したURLを state.loadedAssets に整理して格納
            assets.forEach(a => {
                const url = a.image_url || a.image;
                if (!url) return;
                if (a.asset_type === 'special') state.loadedAssets.special[a.tag] = url;
                if (a.asset_type === 'background' || a.asset_type === 'bg') state.loadedAssets.bg[a.tag] = url;
                if (a.asset_type === 'character') {
                    state.loadedAssets.char[`${a.tag}_${a.face || 'normal'}`] = url;
                }
            });

            // 2. エピソード選択肢の生成（既存の処理）
            await populateEpisodeSelect();
            
            // 3. セーブデータの確認と読み込み（既存の処理）
            const savedData = loadProgress();
            let startEp = state.episodeNumbers[0];
            let startIndex = 0;
            
            if (savedData && state.episodeNumbers.includes(savedData.episode)) {
                startEp = savedData.episode;
                startIndex = savedData.index || 0;
            }

            ui.epSelect.value = startEp;
            
            // 4. エピソードデータの読み込み
            // ここで先ほど作った state.loadedAssets を使ってURLが紐付けられます
            await loadEpisodeData(startEp, startIndex);

        } catch (e) {
            console.error(e);
            alert('初期化エラー: ' + e.message);
            showLoading(false);
        }
    }


function setupMainControls() {
   let mainTouchStartX = 0;
let mainTouchStartTime = 0;

ui.container.addEventListener('touchstart', (e) => {
    if (state.isInlineEditing || (ui.modal && ui.modal.style.display === 'flex')) return;
    mainTouchStartX = e.changedTouches[0].screenX;
    mainTouchStartTime = Date.now(); // タップかスワイプかの判別用
}, { passive: true });

// 既存の pointerup 内にあるページ送りロジックは必ず削除してください
ui.container.addEventListener('pointerup', e => {
    if (state.isInlineEditing) return;
    if (state.modalMode || ui.modal.style.display === 'flex') return;
    if (e.target.closest('#floating-controls')) return;
    if (e.target.closest('#dialogue-box')) return;
    
    // ここには prevScene/nextScene を書かない（touchendに集約したため）
});
   
}
// スクリプトの最後の方で実行
document.addEventListener('DOMContentLoaded', () => {
    // 既存の初期化処理...
    setupMainControls();
});

function renderScene(s) {
    if (!s) return;
    ui.name.textContent = s.character || '';
    ui.text.textContent = s.text || '';

    // --- 🌌 背景の描画 ---
    updateImage(ui.bgDiv, s.background_image || s.background, state.loadedAssets.bg, true);
    updateImage(ui.charImg, s.character_image || s.character, state.loadedAssets.char, false);



// --- 🖼️ 特別演出（Special）の表示処理だけを追加 ---

    if (s.special && s.special !== "OFF") {
        // 特別画像を表示
        updateImage(ui.specialImg, s.special, state.loadedAssets.special, false);

        ui.specialImg.style.display = 'block';

    } else {

        // OFFの時は隠す

        ui.specialImg.style.display = 'none';

        ui.specialImg.src = '';

    }



    // --- ✨ エフェクトの描画 ---

    updateImage(ui.effectImg, s.effect_image || s.effect, state.loadedAssets.effect, false);



    // キャラクターの演出クラス

    ui.charImg.className = '';

    if (s.effect && String(s.effect).includes('影')) {

        ui.charImg.classList.add('flashback-shadow');

    }

   

    saveProgress();
    updateHUDValues(); // シーンが変わるたびにHUDの数値（シークバー等）を更新

}

function updateImage(el, tag, assetStore, isBg) {
        const currentScene = state.episodeData[state.sceneIndex];
        let src = '';
        
        if (tag && (tag.startsWith('http') || tag.startsWith('data:'))) {
            src = tag;
        } 
        else if (tag && assetStore) {
            if (el === ui.charImg && currentScene) {
                const faceTag = currentScene.face || 'default';
                const key = `${tag}_${faceTag}`; 
                
                if (assetStore[key]) src = assetStore[key];
                else if (assetStore[tag]) src = assetStore[tag];
            } else {
                if (assetStore[tag]) src = assetStore[tag];
            }
        }

        if (isBg) {
            if (!src) {
                el.classList.remove('visible');
            } else {
                if (el.style.backgroundImage.includes(src)) {
                     el.classList.add('visible'); 
                     return;
                }
                const img = new Image();
                img.src = src;
                img.onload = () => {
                    el.style.backgroundImage = `url("${src}")`;
                    el.classList.add('visible');
                };
            }
        } else {
            if (!src) {
                el.classList.remove('visible');
                el.src = '';
                el.style.display = 'none';
            } else {
                el.style.display = 'block';
                if (el.src === src && el.classList.contains('visible')) return;

                el.classList.remove('visible');
                el.src = src;
                
                if (el.complete) {
                    el.classList.add('visible');
                } else {
                    el.onload = () => el.classList.add('visible');
                }
            }
        }
    }

function updateHUDValues() {
    if (!state.episodeData || state.episodeData.length === 0) return;

    const total = state.episodeData.length;
    const current = state.sceneIndex + 1;
    const epNum = state.currentEpisode || "-";

    // ヘッダー更新
    const epDisplay = document.getElementById('hud-episode-number');
    if (epDisplay) epDisplay.textContent = `← 第 ${epNum} 話`;

    // シークバー更新
    const seekbar = document.getElementById('hud-seekbar');
  if (seekbar) {
    // シークバー上でのタップやクリックがコンテナ（背景）に伝わらないようにする
    seekbar.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
    seekbar.addEventListener('click', (e) => e.stopPropagation());
    
    seekbar.addEventListener('input', (e) => {
        const index = parseInt(e.target.value);
        state.sceneIndex = index;
        renderScene(state.episodeData[index]);
    });
}

    // カウンター更新（新しいIDに合わせて適用）
    const curDisp = document.getElementById('hud-current-scene');
    const totDisp = document.getElementById('hud-total-scenes');
    if (curDisp) curDisp.textContent = current;
    if (totDisp) totDisp.textContent = total;
}

// --- 6. 📥 データ取得・加工 --
async function loadEpisodeData(episodeNumber, target_scene_number = null) {
    showLoading(true);
    
    state.currentEpisodeId = episodeNumber;
    try {
        // 1. Supabaseからデータを取得
const { data, error } = await supabaseClient
    .from('scenes') // ← 実際のテーブル名に変更
    .select('*')
            .eq('episode', episodeNumber)
            .order('scene_number', { ascending: true });

        if (error) throw error;
        
        if (!data || data.length === 0) {
            alert('指定されたエピソードにデータがありません。');
            return;
        }

        
data.forEach(scene => {
    // 背景URLの解決
    if (scene.background && !scene.background_image) {
        scene.background_image = state.loadedAssets.bg[scene.background] || "";
    }
    if (scene.character) {
        // 重要：'normal' という文字列をデフォルトにしつつ、タグと表情をアンダーバーで繋ぐ
        const faceTag = scene.character_face || scene.face || "normal"; 
        const charKey = `${scene.character}_${faceTag}`;
        
        // state.loadedAssets.char に格納されているキーと一致させる
        scene.character_image = state.loadedAssets.char[charKey] || "";
    }
    // 演出画像(special)URLの解決
    if (scene.special && scene.special !== "OFF") {
        scene.special_image = state.loadedAssets.special[scene.special] || "";
    }
});
        // --- 📥 データの穴埋め・背景引き継ぎ処理 ---
        let lastCharacterImg = "";
        let characterDisplayEnabled = false; 
        
        // 【重要】背景は「グローバルに保存されている前回の画像」から開始する
        let currentProcessBackground = globalLastBackground;

// --- 📥 データの穴埋め・背景引き継ぎ処理 --- の直前あたりに追加

        // --- ★新機能：アセットセレクトボックスのOptionを生成する ---
        // 汎用関数
        const populateSelect = (select, tags, isOptional = true) => {
            select.innerHTML = '';
            if (isOptional) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = '(なし)';
                select.appendChild(opt);
            }
            tags.forEach(tag => {
                if (!tag) return;
                const opt = document.createElement('option');
                opt.value = tag;
                opt.textContent = tag;
                select.appendChild(opt);
            });
        };

        // アセットの抽出（既存の処理）
        const charTags = new Set();
        const bgTags = new Set();
        const specialTags = new Set();
        const effectTags = new Set();
        // ... (data.forEach 内で各Setにtagを追加する既存のループ処理) ...
        data.forEach(scene => {
            if (scene.background) bgTags.add(scene.background);
            if (scene.face) charTags.add(scene.face);
            if (scene.special) specialTags.add(scene.special);
            if (scene.effect) effectTags.add(scene.effect);
        });


        // --- データの穴埋め（filledData）へ続く ---

       const filledData = data.map(scene => {
            // --- A. 背景の引き継ぎ処理 ---
            if (!scene.background_image || scene.background_image === "") {
                scene.background_image = currentProcessBackground;
            } else {
                if (currentProcessBackground !== scene.background_image) {
                    characterDisplayEnabled = false;
                }
                currentProcessBackground = scene.background_image;
            }

            // --- B. 挿絵モード（Special）の判定 ---
            const isIllustrationMode = (scene.special && scene.special !== "OFF");

            // --- C. キャラクター画像の処理（★ここが正解のロジック） ---
            const charName = (scene.character || "").trim();
            // ナレーション、チハルなどは「画像を更新しないが、表示は維持する」対象
            const isKeepLastCharTarget = ["ナレーション", "チハル", "？？？"].includes(charName);

            // 1. 新しいキャラクター画像がある場合は、それを最新として保存
            if (charName !== "" && !isKeepLastCharTarget && scene.character_image) {
                characterDisplayEnabled = true;
                lastCharacterImg = scene.character_image;
            }

            // 2. 表示の確定ロジック
            if (isIllustrationMode) {
                scene.character_image = ""; // 挿絵の時はキャラを隠す
            } else if (!characterDisplayEnabled) {
                scene.character_image = ""; // まだ誰も登場していない時は空
            } else {
                // 通常時、または「ナレーション/チハル」の時
                if (!scene.character_image || scene.character_image === "" || isKeepLastCharTarget) {
                    // 🌟 ここがポイント：画像が空、またはナレーション等の時は「直前の画像」を代入する
                    scene.character_image = lastCharacterImg;
                } else {
                    // 新しい画像がある場合はそれを更新
                    lastCharacterImg = scene.character_image;
                }
            }
            return scene;
        });

        // 最後に現れた背景画像URLを保存（次のエピソード読み込み時に利用）
        globalLastBackground = currentProcessBackground;

        // 2. 状態を更新
        state.episodeData = filledData;

        // ★ ここに追加: 現在のエピソード番号を確実に保持する
        state.currentEpisode = episodeNumber;

        // 3. 表示位置（インデックス）を決定
        if (target_scene_number) {
            const idx = filledData.findIndex(s => Number(s.scene_number) === Number(target_scene_number));
            state.sceneIndex = idx !== -1 ? idx : 0;
        } else {
            state.sceneIndex = 0;
        }

        renderScene(state.episodeData[state.sceneIndex]); 
     
        
        // ★ ここに追加: HUD（第○話、シークバー等）の表示を更新
        updateHUDValues();

        updateUI();

    } catch (err) {
        console.error('Data loading error:', err);
        alert('読み込みエラー: ' + err.message);
    } finally {
        showLoading(false);
    }
}


// --- 7. 🖱️ インタラクション ---
// クリックで次へ
ui.container.addEventListener('pointerup', e => {
    // インライン編集モード中、またはモーダル表示中はガード
    if (state.isInlineEditing) return;
    if (state.modalMode || ui.modal.style.display === 'flex') return;
    
    // UIパーツ（ボタンやダイアログ）のクリックは許容するが、
    // それ以外の「画面の左右タップ」による prevScene() / nextScene() を削除します。
    
    if (e.target.closest('#floating-controls')) return;
    if (e.target.closest('#dialogue-box')) return;

    // ★ ここにあった isLeft の判定と prevScene/nextScene の実行を削除しました。
    // これにより、タップしても何も起きなくなります。
});

// スワイプ・HUD操作
let touchStartX = 0;
ui.container.addEventListener('touchstart', (e) => {
    if (state.isInlineEditing || (ui.modal && ui.modal.style.display === 'flex')) return;
    mainTouchStartX = e.changedTouches[0].screenX;
}, { passive: true });
    // --- タッチイベントの最終版 ---
   ui.container.addEventListener('touchend', (e) => {
    // 🌟 修正：モーダルを開くヘッダーや、HUD内の操作エリアを触っている時は無視する
    if (
        e.target.closest('button') || 
        e.target.closest('.control-button') || 
        e.target.closest('.hud-icon-btn-mini') ||
        e.target.closest('.hud-header-left') || // 🌟 これを追加
        e.target.closest('#hud-seekbar')        // 🌟 シークバー操作も除外しておくと安全
    ) {
        return; 
    }

    if (state.isInlineEditing || (ui.modal && ui.modal.style.display === 'flex')) return;
        if (e.cancelable) e.preventDefault();

        const mainTouchEndX = e.changedTouches[0].screenX;
        const swipeDistance = mainTouchEndX - mainTouchStartX;
        const threshold = 50;

        if (Math.abs(swipeDistance) > threshold) {
            // スワイプ：直感的な方向（左スワイプで次へ）に合わせる場合はここを調整
            if (swipeDistance < -threshold) {
                handleNavigation('next'); 
            } else {
                handleNavigation('prev');
            }
            return;
        }

        const touchX = e.changedTouches[0].clientX;
        const screenWidth = window.innerWidth;
        const edgeSize = screenWidth * 0.15;

        if (touchX < edgeSize) {
            handleNavigation('next');
        } else if (touchX > screenWidth - edgeSize) {
            handleNavigation('prev');
        } else {
            toggleHUD();
        }
    }, { passive: false });
// シークバー
document.getElementById('hud-seekbar').addEventListener('input', (e) => {
    const index = parseInt(e.target.value);
    state.sceneIndex = index;
    renderScene(state.episodeData[index]);
    // updateHUDInfo または updateHUDValues を呼んで数字を更新
    updateHUDInfo(); 
});
// シークバーを動かした時の処理
document.getElementById('hud-seekbar').oninput = (e) => {
    state.sceneIndex = parseInt(e.target.value);
    renderScene(state.episodeData[state.sceneIndex]);
};

// --- 8. ✍️ インライン編集ロジック ---
ui.inlineEditBtn.onclick = (e) => {
    e.stopPropagation();
    state.isInlineEditing = true;
    
    const s = state.episodeData[state.sceneIndex];
    if (!s) return;

    // 値をセット
    ui.inlineEditName.value = s.character || "";
    ui.inlineEditFace.value = s.face || ""; // テキスト入力欄に表情名をセット
    ui.inlineEditTextarea.value = s.text || "";

    // 表示切り替え
    ui.name.style.display = 'none';
    ui.text.style.display = 'none';
    ui.inlineEditBtn.style.display = 'none';
    ui.inlineEditForm.style.display = 'flex';
    
    if (ui.charImg) ui.charImg.style.cursor = 'pointer';
    if (ui.novelAssetControls) ui.novelAssetControls.style.display = 'flex';
    ui.inlineEditTextarea.focus();
};

// --- 9. 🗂️ エピソード・モーダル管理 ---
// エピソード編集画面を開く
function openEpisodeEdit() {
    const epId = document.getElementById('ep-dial-select').value;
    if (!epId) {
        alert("編集するエピソードを先に選択してください");
        return;
    }
    document.getElementById('ep-preview-area').style.display = 'none';
    document.getElementById('ep-edit-form-area').style.display = 'block';
    
    // 現在の値をフォームにセット
    document.getElementById('edit-ep-title').value = document.getElementById('preview-title')?.textContent || "";
    document.getElementById('edit-ep-summary').value = document.getElementById('preview-summary').textContent || "";
}

function closeEpisodeEdit() {
    document.getElementById('ep-edit-form-area').style.display = 'none';
    document.getElementById('ep-preview-area').style.display = 'block';
}

// エピソード情報の保存
async function saveEpisodeInfo() {
    const epId = document.getElementById('ep-dial-select').value;
    const newTitle = document.getElementById('edit-ep-title').value;
    const newSummary = document.getElementById('edit-ep-summary').value;

    showLoading(true);
    try {
        const { error } = await supabaseClient
            .from('episodes')
            .upsert({ 
                id: parseInt(epId), 
                title: newTitle, 
                summary: newSummary 
            });

        if (error) throw error;
        alert("エピソード情報を更新しました");
        
        // リロードせずに表示を更新
        renderEpisodeDial(); 
        closeEpisodeEdit();
    } catch (err) {
        alert("保存に失敗しました: " + err.message);
    } finally {
        showLoading(false);
    }
}
// 画面上のUI（ボタンの活性・非活性など）を更新する関数
function updateUI() {
    if (!state.episodeData || state.episodeData.length === 0) return;

    const isFirst = state.sceneIndex === 0;
    const isLast = state.sceneIndex === state.episodeData.length - 1;

    // 前へ・次へボタンの制御（ID名はご自身のHTMLに合わせてください）
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) prevBtn.disabled = isFirst;
    if (nextBtn) nextBtn.disabled = isLast;

    // 現在の進捗表示（例：1 / 20）
    const counter = document.getElementById('scene-counter');
    if (counter) {
        counter.textContent = `${state.sceneIndex + 1} / ${state.episodeData.length}`;
    }
}

// 閉じる処理も確実に
window.closeModal = () => {
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
};

/**
 * キャラクタープロフィールを表示
 * @param {string} charName 
 */
async function showCharacterProfile(charName) {
    showLoading(true);
    try {
        // 1. キャラクターの基本画像と情報を取得 (assetsテーブルや、もしあればcharactersテーブルから)
        // ここでは assets から 'normal' 顔を取得する例
        const faceKey = `${charName}_normal`;
        const imgUrl = state.loadedAssets.char[faceKey] || "";

        // 2. 表示内容のセット
        document.getElementById('profile-char-name').textContent = charName;
        document.getElementById('profile-char-img').src = imgUrl;
        
        // 紹介文（現状は仮。Supabaseにテーブルを作ればそこから取得可能）
        document.getElementById('profile-char-description').textContent = 
            `${charName}のプロフィール情報です。現在はアセットタグ「${charName}」として登録されています。`;

        // 3. 詳細ページへのリンク設定
        // URLパラメータで名前を渡すと、character_settings.html側でフィルタリングしやすくなります
        document.getElementById('go-to-settings-btn').href = `character_settings.html?char=${encodeURIComponent(charName)}`;

        // 4. 表示
        document.getElementById('character-profile-modal').style.display = 'flex';
    } catch (e) {
        console.error(e);
    } finally {
        showLoading(false);
    }
}

function closeProfileModal() {
    document.getElementById('character-profile-modal').style.display = 'none';
}

// エピソード一覧の生成ロジック内で、名前をただのテキストではなく「クリックできるボタン」にする
function createCharTags(charString) {
    if (!charString) return "";
    return charString.split(',').map(name => {
        // クリックイベントを仕込んだHTMLを生成
        return `<span class="char-tag clickable" onclick="event.stopPropagation(); showCharacterProfile('${name.trim()}')">${name.trim()}</span>`;
    }).join('');
}


// --- 10. 🛠️ ユーティリティ ---
    function showLoading(show) {
        ui.loading.style.opacity = show ? 1 : 0;
        ui.loading.style.pointerEvents = show ? 'auto' : 'none';
    }

    function saveProgress() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
            episode: parseInt(ui.epSelect.value),
            index: state.sceneIndex
        }));
    }

    function loadProgress() {
        const json = localStorage.getItem(CONFIG.STORAGE_KEY);
        return json ? JSON.parse(json) : null;
    }



// メッセージウィンドウ内でのクリックを「外側（進む・戻る）」に伝えない
ui.dialogueBox.onclick = (e) => {
    e.stopPropagation(); 
};


async function preloadAssetsSmart(currentIndex, count) {
    const endIndex = Math.min(currentIndex + count, state.episodeData.length);
    const targets = state.episodeData.slice(currentIndex, endIndex);
    
    const required = { bg: new Set(), char: new Set(), special: new Set(), effect: new Set() };
    
    targets.forEach(s => {
        if (s.background && !state.loadedAssets.bg[s.background]) required.bg.add(s.background);
        if (s.character && !state.loadedAssets.char[s.character]) required.char.add(s.character);
        // special（森の中など）を収集
        if (s.special && s.special !== "OFF" && !state.loadedAssets.special[s.special]) {
    required.special.add(s.special);
}
        if (s.effect && !state.loadedAssets.effect[s.effect]) required.effect.add(s.effect);
    });

    const promises = [];
    if (required.bg.size) promises.push(fetchAssets('background', required.bg, state.loadedAssets.bg));
    if (required.char.size) promises.push(fetchAssets('character', required.char, state.loadedAssets.char));
    // ここで special を一括取得
        if (required.special.size) promises.push(fetchAssets('special', required.special, state.loadedAssets.special));   if (required.effect.size) promises.push(fetchAssets('effect', required.effect, state.loadedAssets.effect));
   if (required.effect.size) promises.push(fetchAssets('effect', required.effect, state.loadedAssets.effect));

    await Promise.all(promises);
}

async function backgroundLoadRest(startIndex) {
        const CHUNK = 10;
        for (let i = startIndex; i < state.episodeData.length; i += CHUNK) {
            await preloadAssetsSmart(i, CHUNK);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
async function fetchAssets(type, tagSet, targetStore) {
    if (!tagSet.size && type !== 'special') return;
    
    try {
        const { data: list, error } = await supabaseClient
            .from('assets')
            .select('*')
            .eq('asset_type', type);

        if (error) throw error;

        (list || []).forEach(a => {
            const url = a.image_url || a.image; // image_url を優先
            if (a.tag && url) {
                // キャラクターのキー作成ロジック（以前の挙動を維持）
                if ((type === 'character' || type === 'char') && (a.character_face_tag || a.face)) {
                    const faceTag = a.character_face_tag || a.face;
                    const key = `${a.tag}_${faceTag}`;
                    targetStore[key] = url;
                } else {
                    targetStore[a.tag] = url;
                }
            }
        });
        console.log(`Assets loaded for ${type}:`, Object.keys(targetStore).length);
    } catch (e) {
        console.warn(`Failed to fetch assets for ${type}:`, e);
    }
}


// タブ切り替え
window.switchInlineEditTab = (tab) => {
    const tChar = document.getElementById('tab-content-char');
    const tAsset = document.getElementById('tab-content-asset');
    const bChar = document.getElementById('tab-btn-char');
    const bAsset = document.getElementById('tab-btn-asset');
    if (!tChar || !tAsset) return;

    if (tab === 'char') {
        tChar.style.display = 'block'; tAsset.style.display = 'none';
        bChar.classList.add('active'); bAsset.classList.remove('active');
    } else {
        tChar.style.display = 'none'; tAsset.style.display = 'block';
        bChar.classList.remove('active'); bAsset.classList.add('active');
    }
};

// 編集開始ボタンの動作
if (ui.inlineEditBtn) {
    ui.inlineEditBtn.onclick = (e) => {
        e.stopPropagation();
        
        // 現在表示中のシーンデータを取得
        const s = state.episodeData[state.sceneIndex];
        if (!s) return;

        state.isInlineEditing = true;

        // --- 既存のデータを入力欄にセット ---
        ui.inlineEditName.value = s.character || "";
        ui.inlineEditFace.value = s.face || "";
        ui.inlineEditTextarea.value = s.text || "";
        
   // 背景・演出タブの項目（DBのフィールド名と合わせる）
        if (ui.inlineEditBg) ui.inlineEditBg.value = s.background || "";
        if (ui.inlineEditSpecial) ui.inlineEditSpecial.value = s.special || ""; // 以前のフォーム名に合わせて 'special'
        if (ui.inlineEditEffect) ui.inlineEditEffect.value = s.effect || "";   // 以前のフォーム名に合わせて 'effect'

        // 表示の切り替え
        ui.displayArea.style.display = 'none';
        ui.inlineEditForm.style.display = 'flex';
        
        // 初期タブを「キャラ・台詞」に設定
        switchInlineEditTab('char');
    };
}

// 戻るボタン
if (ui.inlineCancelBtn) {
    ui.inlineCancelBtn.onclick = (e) => {
        e.stopPropagation();
        state.isInlineEditing = false;
        ui.inlineEditForm.style.display = 'none';
        ui.displayArea.style.display = 'block';
    };
}

function nextScene() {
        if (state.sceneIndex < state.episodeData.length - 1) {
            state.sceneIndex++;
            renderScene(state.episodeData[state.sceneIndex]);
        } else {
            tryNextEpisode();
        }
    }

function prevScene() {
        if (state.sceneIndex > 0) {
            state.sceneIndex--;
            renderScene(state.episodeData[state.sceneIndex]);
        }
    }

function tryNextEpisode() {
        const currentEp = parseInt(ui.epSelect.value);
        const idx = state.episodeNumbers.indexOf(currentEp);
        if (idx !== -1 && idx < state.episodeNumbers.length - 1) {
            if(confirm('次のエピソードへ進みますか？')) {
                const nextEp = state.episodeNumbers[idx + 1];
                ui.epSelect.value = nextEp;
                loadEpisodeData(nextEp);
            }
        }
    }

async function fetchJson(url, params = {}) {
        const urlObj = new URL(url);
        if(params.filters) urlObj.searchParams.append('filters', params.filters);
        const res = await fetch(urlObj.toString());
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        return res.json();
    }

async function populateEpisodeSelect() {
    try {
        // 修正ポイント：全行取得ではなく、一意(unique)なエピソード番号のみを取得するように最適化
 // populateEpisodeSelect内
const { data, error } = await supabaseClient
    .from('distinct_episodes')
    .select('*');
// ...あとは data.map(d => d.episode) で取得可能

        if (error) throw error;

        // Setを使ってJS側で確実に重複を排除
        const eps = new Set();
        data.forEach(s => { 
            if(s.episode !== null && s.episode !== undefined) {
                eps.add(Number(s.episode)); 
            }
        });

        // 数値として昇順にソート（1, 2, ... 10, 11 と正しく並ぶようにする）
        state.episodeNumbers = Array.from(eps).sort((a, b) => a - b);
        
        console.log("取得済みエピソード一覧:", state.episodeNumbers);

        if (state.episodeNumbers.length === 0) {
            console.warn('エピソードが見つかりません。');
            return;
        }

        // プルダウン（隠し要素）の生成
        ui.epSelect.innerHTML = '';
        state.episodeNumbers.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep;
            opt.textContent = `第 ${ep} 話`;
            ui.epSelect.appendChild(opt);
        });

        // モーダル内のエピソードボタン一覧を再描画する必要がある場合はここで実行
        // (openModal時に描画する設計ならそのままでOK)

    } catch (e) {
        console.error('エピソードリストの取得に失敗しました:', e);
    }
}

function openModal(type) {
    const modal = document.getElementById('modal');
    if (!modal) return;

    // 1. モーダル全体を表示
    modal.style.display = 'flex';

    // 2. HUD（ヘッダー・フッター）が開いたままだと邪魔なので隠す
    const hud = document.getElementById('viewer-hud');
    if (hud) hud.style.display = 'none';

    // 3. モーダル内の表示切り替え
    const previewArea = document.getElementById('ep-preview-area');
    const previewFooter = document.getElementById('ep-preview-footer');
    const editArea = document.getElementById('ep-edit-form-area');
    const editFooter = document.getElementById('ep-edit-footer');

    // 「物語を選択（あらすじ表示）」モードの場合
    if (previewArea) previewArea.style.display = 'block';
    if (previewFooter) previewFooter.style.display = 'flex';
    
    // 編集画面などは隠しておく
    if (editArea) editArea.style.display = 'none';
    if (editFooter) editFooter.style.display = 'none';

    // 4. データの生成と読み込み
    // プルダウンを生成
    if (typeof renderEpisodeDial === 'function') {
        renderEpisodeDial(); 
    }
    // 現在のエピソード情報をプレビューに反映
    if (typeof updateEpisodePreview === 'function') {
        updateEpisodePreview(state.currentEpisode);
    }
}


async function renderEpisodeDial() {
    const select = document.getElementById('ep-dial-select');
    const previewArea = document.getElementById('ep-preview-area');
    const previewFooter = document.getElementById('ep-preview-footer');
    
    const { data: episodes, error } = await supabaseClient.from('distinct_episodes').select('*');
    if (error || !episodes) return;

    // プルダウン生成（中略：以前のロジックと同様）
    select.innerHTML = '<option value="">話を選択</option>';
    episodes.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.episode;
        opt.textContent = `第${ep.episode}話：${ep.title || ''}`;
        select.appendChild(opt);
    });

    // 表示更新関数
    const updateDisplay = async (epId) => {
        const ep = episodes.find(e => e.episode == epId);
        if (ep) {
            select.value = epId;
            updatePreviewUI(ep); // 以前作成したUI更新関数
            previewArea.style.display = 'block';
            previewFooter.style.display = 'flex';
            
            // アニメーション適用
            previewArea.classList.remove('fade-in-swipe');
            void previewArea.offsetWidth; // reflow
            previewArea.classList.add('fade-in-swipe');
        }
    };

    select.onchange = () => updateDisplay(select.value);

    // --- 左右スワイプの実装 ---
    const container = document.getElementById('episode-list-container');
    
    container.ontouchstart = e => {
        touchStartX = e.changedTouches[0].screenX;
    };

    container.ontouchend = e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    };

    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        const threshold = 50; // スワイプと判定する距離
        
        const currentIndex = episodes.findIndex(e => e.episode == select.value);
        
        if (swipeDistance < -threshold) {
            // 右から左へスワイプ：次のエピソード
            if (currentIndex < episodes.length - 1) {
                updateDisplay(episodes[currentIndex + 1].episode);
            }
        } else if (swipeDistance > threshold) {
            // 左から右へスワイプ：前のエピソード
            if (currentIndex > 0) {
                updateDisplay(episodes[currentIndex - 1].episode);
            }
        }
    }

    // 初期表示（現在のエピソード）
    if (ui.epSelect.value) {
        updateDisplay(ui.epSelect.value);
    }
}

// 編集画面の切り替え時もフッターを制御
function openEpisodeEdit() {
    document.getElementById('ep-preview-area').style.display = 'none';
    document.getElementById('ep-preview-footer').style.display = 'none';
    document.getElementById('ep-edit-form-area').style.display = 'block';
    document.getElementById('ep-edit-footer').style.display = 'flex';
}

function closeEpisodeEdit() {
    document.getElementById('ep-edit-form-area').style.display = 'none';
    document.getElementById('ep-edit-footer').style.display = 'none';
    document.getElementById('ep-preview-area').style.display = 'block';
    document.getElementById('ep-preview-footer').style.display = 'flex';
}




// プレビュー表示の共通処理
async function updatePreviewUI(ep) {
    document.getElementById('preview-title').textContent = `第${ep.episode}話 ${ep.title || ''}`;
    document.getElementById('preview-summary').textContent = ep.summary || "あらすじはありません。";
    
    const exclude = ['ナレーション', 'チハル', 'なし', ''];
    const filteredChars = (ep.characters || "").split(', ').filter(c => !exclude.includes(c));
    document.getElementById('preview-characters').innerHTML = 
        filteredChars.map(c => `<span class="ep-tag">${c}</span>`).join('') || "（主要キャラのみ）";

    // 背景（場所）を動的に取得
    const { data: scenes } = await supabaseClient.from('scenes').select('background').eq('episode', ep.episode);
    const locations = [...new Set(scenes.map(s => s.background).filter(Boolean))];
    document.getElementById('preview-locations').textContent = locations.join('、') || "設定なし";

    document.getElementById('start-episode-btn').onclick = () => {
        ui.epSelect.value = ep.episode;
        loadEpisodeData(ep.episode);
        closeModal();
    };
}

function toggleImmersiveEdit() {
    // 編集ボタン（鉛筆）がすでにHTML内にある ui.inlineEditBtn と連動させます
    if (ui.inlineEditBtn) {
        // 編集フォームが閉じているなら開き、開いているなら保存（またはキャンセル）
        if (ui.inlineEditForm.style.display === 'none') {
            ui.inlineEditBtn.click(); // 既存の編集開始処理を呼び出す
            document.body.classList.add('editing-active');
        } else {
            // 保存かキャンセルかは運用によりますが、ここでは一旦閉じます
            ui.inlineCancelBtn.click();
            document.body.classList.remove('editing-active');
        }
    }
}

window.closeModal = () => {
    if (!ui.modal) return; // モーダルがない場合は中断
    
    ui.modal.style.display = 'none';
    state.modalMode = '';
    
    // 【修正】要素が存在するか確認してから style を操作する
    const addBtn = document.getElementById('header-add-switch-btn');
    if (addBtn) {
        addBtn.style.display = 'block';
    }
};


if (ui.inlineEditBtn) {
    let characterFaceCache = {};

    // --- 表情連動関数 ---
    const updateFaceOnly = async (nextFace) => {
        const s = state.episodeData[state.sceneIndex];
        if (!s) return;
        try {
            await supabaseClient.from('scenes').update({ face: nextFace }).eq('id', s.id);
            const { data: assetData } = await supabaseClient.from('assets').select('image_url').eq('asset_type', 'character').eq('tag', s.character).eq('face', nextFace).single();
            s.face = nextFace;
            if (assetData) s.character_image = assetData.image_url;
            if (ui.inlineEditFace) ui.inlineEditFace.value = nextFace;
            renderScene(s); 
        } catch (err) { console.error("表情更新失敗:", err); }
    };
// --- キャラ画像タッチで表情切り替え ---
    if (ui.charImg) {
        ui.charImg.addEventListener('pointerup', async (e) => {
            if (!state.isInlineEditing) return;
            e.stopPropagation();
            
            const s = state.episodeData[state.sceneIndex];
            if (!s || !s.character || s.character === "ナレーション") return;

            // 1. 表情リストの取得（キャッシュ利用）
            let faceList = characterFaceCache[s.character];
            if (!faceList) {
                const { data } = await supabaseClient.from('assets')
                    .select('face')
                    .eq('asset_type', 'character')
                    .eq('tag', s.character);
                if (data) { 
                    faceList = data.map(item => item.face); 
                    characterFaceCache[s.character] = faceList; 
                }
            }

            if (faceList && faceList.length >= 2) {
                // 2. 現在の表情を特定（一時保存データがあればそれを優先、なければマスターから）
                const currentFace = (state.tempEditData && state.tempEditData.face) ? state.tempEditData.face : s.face;
                const currentIndex = faceList.indexOf(currentFace);
                const nextIndex = (currentIndex + 1) % faceList.length;
                const nextFace = faceList[nextIndex];

                // 3. 【重要】マスターデータは書き換えずに、一時変数(tempEditData)にメモする
                state.tempEditData = { 
                    ...state.tempEditData, 
                    face: nextFace 
                };

                // 4. 画面上の見た目だけを即座に更新する
                // 画像URLを取得して、ui.charImg.src を直接書き換える
                const { data: assetData } = await supabaseClient
                    .from('assets')
                    .select('image_url')
                    .eq('asset_type', 'character')
                    .eq('tag', s.character)
                    .eq('face', nextFace)
                    .single();

                if (assetData && assetData.image_url) {
                    ui.charImg.src = assetData.image_url;
                }
            }
        });
    }
    
    // --- シーン追加（現在のシーンをコピーして次に挿入） ---
if (ui.inlineAddBtn) {
        ui.inlineAddBtn.onclick = async (e) => {
            e.stopPropagation();
            const s = state.episodeData[state.sceneIndex];
            if (!s) return;
            if (!confirm("現在のシーンをコピーして新しく追加しますか？")) return;

            try {
                showLoading(true);
                const newSceneNum = s.scene_number + 1;
                const episodeId = s.episode;

                // 1. 後続の番号を後ろから順に+1
                const { data: laterScenes } = await supabaseClient
                    .from('scenes')
                    .select('id, scene_number')
                    .eq('episode', episodeId)
                    .gte('scene_number', newSceneNum)
                    .order('scene_number', { ascending: false });

                if (laterScenes) {
                    for (const row of laterScenes) {
                        await supabaseClient.from('scenes').update({ scene_number: row.scene_number + 1 }).eq('id', row.id);
                    }
                }

                // 2. コピー挿入
                const { error } = await supabaseClient.from('scenes').insert([{
                    episode: episodeId,
                    scene_number: newSceneNum,
                    character: s.character,
                    face: s.face,
                    background: s.background,
                    text: s.text 
                }]);

                if (error) throw error;
                window.location.reload();
            } catch (err) { alert("追加失敗: " + err.message); } 
            finally { showLoading(false); }
        };
    }
 // --- シーン削除 ---
 if (ui.inlineDeleteBtn) {
        ui.inlineDeleteBtn.onclick = async (e) => {
            e.stopPropagation();
            const s = state.episodeData[state.sceneIndex];
            if (!s || !confirm("このシーンを削除してもよろしいですか？")) return;

            try {
                showLoading(true);
                const deletedNum = s.scene_number;
                const episodeId = s.episode;

                await supabaseClient.from('scenes').delete().eq('id', s.id);

                const { data: laterScenes } = await supabaseClient
                    .from('scenes')
                    .select('id, scene_number')
                    .eq('episode', episodeId)
                    .gt('scene_number', deletedNum)
                    .order('scene_number', { ascending: true });

                if (laterScenes) {
                    for (const row of laterScenes) {
                        await supabaseClient.from('scenes').update({ scene_number: row.scene_number - 1 }).eq('id', row.id);
                    }
                }
                window.location.reload();
            } catch (err) { alert("削除失敗: " + err.message); } 
            finally { showLoading(false); }
        };
    }
// --- 保存ボタン ---
if (ui.inlineSaveBtn) {
    ui.inlineSaveBtn.onclick = async (e) => {
        e.stopPropagation();
        const s = state.episodeData[state.sceneIndex];
        if (!s) return;

        try {
            showLoading(true);

            // 1. フォームと一時データから更新用オブジェクトを作成
            const up = { 
                character: ui.inlineEditName.value, 
                face: (state.tempEditData && state.tempEditData.face) ? state.tempEditData.face : ui.inlineEditFace.value, 
                text: ui.inlineEditTextarea.value, 
                background: ui.inlineEditBg ? ui.inlineEditBg.value : s.background,
                special: ui.inlineEditSpecial ? ui.inlineEditSpecial.value : s.special,
                effect: ui.inlineEditEffect ? ui.inlineEditEffect.value : s.effect
            };

            // 2. Supabaseを更新
            const { error } = await supabaseClient.from('scenes').update(up).eq('id', s.id);
            if (error) throw error;

// 3. 最新の結合データを取得（画像URLを確定させる）
            const { data: updatedScene, error: fetchError } = await supabaseClient
                .from('vs_scenes_with_assets')
                .select('*')
                .eq('id', s.id)
                .single();

            if (fetchError) throw fetchError;

            // --- 4. 背景引き継ぎの再適用 ---
            if (!updatedScene.background_image || updatedScene.background_image === "") {
                if (state.sceneIndex > 0) {
                    updatedScene.background_image = state.episodeData[state.sceneIndex - 1].background_image;
                }
            }

            // --- 5. 【新規追加】キャラ画像（ナレーション・チハル）の引き継ぎ再適用 ---
            const charName = updatedScene.character || "";
            const isSkipTarget = (charName === "ナレーション" || charName === "チハル");

            // もしナレーション等で画像が空の場合、前のシーンの画像を借りる
            if (isSkipTarget && (!updatedScene.character_image || updatedScene.character_image === "")) {
                if (state.sceneIndex > 0) {
                    updatedScene.character_image = state.episodeData[state.sceneIndex - 1].character_image;
                }
            }

           // 6. ローカルのデータを更新
            state.episodeData[state.sceneIndex] = updatedScene;

            // 7. 編集モード終了の設定
            state.isInlineEditing = false;
            state.tempEditData = null;

            // --- 🌟 修正ポイント：ここから ---
            
            // 編集画面（レイヤー）を非表示にする
            // ui.inlineEditor が null の場合でもエラーにならないよう、直接取得してチェックします
            const editorEl = document.getElementById('inline-edit-layer'); 
            if (editorEl) {
                editorEl.style.display = 'none';
            }

            // 最新データでビュアーを再描画
            renderScene(state.episodeData[state.sceneIndex]);

            // --- 🌟 修正ポイント：ここまで（不要な ui.inlineEditor... の行は削除） ---
          
            // 次のシーンへの背景引き継ぎ用にグローバル変数も更新しておく
            if (typeof globalLastBackground !== 'undefined') {
                globalLastBackground = updatedScene.background_image;
            }
        } catch (err) { 
            console.error(err);
            alert("保存失敗: " + err.message); 
        } finally { 
            showLoading(false); 
        }
    };
}

// --- キャンセル（戻る）ボタン ---
if (ui.inlineCancelBtn) {
    ui.inlineCancelBtn.onclick = (e) => { 
        e.stopPropagation(); 
        state.isInlineEditing = false;
        state.tempEditData = null; // 一時メモを捨てる
        
        ui.inlineEditForm.style.display = 'none';
        ui.name.style.display = 'block';
        ui.text.style.display = 'block';
        ui.inlineEditBtn.style.display = 'block';

        // 元の保存されているデータ（state内）で描き直すことで見た目を戻す
        renderScene(state.episodeData[state.sceneIndex]);
    };
}


// --- 編集開始（鉛筆アイコン） ---
    ui.inlineEditBtn.onclick = (e) => {
        e.stopPropagation();
        state.isInlineEditing = true;
        const s = state.episodeData[state.sceneIndex];
        if (!s) return;
        
        ui.inlineEditName.value = s.character || "";
        ui.inlineEditFace.value = s.face || "";
        ui.inlineEditTextarea.value = s.text || "";
        // 背景・演出タブのデータ（以前のフォーム名: background, special, effect）
        if (ui.inlineEditBg) ui.inlineEditBg.value = s.background || "";
        if (ui.inlineEditSpecial) ui.inlineEditSpecial.value = s.special || "";
        if (ui.inlineEditEffect) ui.inlineEditEffect.value = s.effect || "";


        ui.name.style.display = 'none';
        ui.text.style.display = 'none';
        ui.inlineEditBtn.style.display = 'none';
        ui.inlineEditForm.style.display = 'flex';
        ui.inlineEditTextarea.focus();
    };
}

function prevScene() {
    if (state.sceneIndex > 0) {
        state.sceneIndex--;
        renderScene(state.episodeData[state.sceneIndex]);
    }
}

function nextScene() {
    if (state.sceneIndex < state.episodeData.length - 1) {
        state.sceneIndex++;
        renderScene(state.episodeData[state.sceneIndex]);
    } else {
        // エピソード終了時の処理が必要ならここに記述
        console.log("エピソードの最後です");
    }
}

// HUDの表示・非表示を切り替える（中央タップで実行）
function toggleHUD() {
    const hud = document.getElementById('viewer-hud');
    if (!hud) return;
    
    if (hud.style.display === 'none') {
        updateHUDInfo(); // 表示する直前に最新の状態に更新
        hud.style.display = 'block';
    } else {
        hud.style.display = 'none';
    }
}

// HUD情報の更新（ページ番号とシークバー）
function updateHUDInfo() {
    if (!state.episodeData || state.episodeData.length === 0) return;

    const total = state.episodeData.length;
    const current = state.sceneIndex + 1;
    const epNum = state.currentEpisode || "-";

    document.getElementById('hud-episode-number').textContent = `← 第 ${epNum} 話`;
    document.getElementById('hud-current-scene').textContent = current;
    document.getElementById('hud-total-scenes').textContent = total;

    const seekbar = document.getElementById('hud-seekbar');
    if (seekbar) {
        seekbar.max = total - 1;
        seekbar.value = state.sceneIndex;
    }
}


// --- 次のエピソードへ ---
async function goToNextEpisode() {
    if (!state.currentEpisode) {
        console.error("現在のエピソード番号が不明です");
        return;
    }
    const nextEp = parseInt(state.currentEpisode) + 1;
    
    // 正しい関数名 loadEpisodeData を使用
    if (typeof loadEpisodeData === 'function') {
        await loadEpisodeData(nextEp);
    } else {
        console.error("loadEpisodeData 関数が見つかりません");
    }
}

// --- 前のエピソードへ ---
async function goToPrevEpisode() {
    if (!state.currentEpisode) return;
    const prevEp = parseInt(state.currentEpisode) - 1;
    
    if (prevEp > 0) {
        // 正しい関数名 loadEpisodeData を使用
        if (typeof loadEpisodeData === 'function') {
            await loadEpisodeData(prevEp);
        } else {
            console.error("loadEpisodeData 関数が見つかりません");
        }
    }
}

// 前後のエピソードへの遷移（仮実装：IDを±1してリロード等）
function goToNextEpisode() {
    const nextEp = parseInt(state.currentEpisode) + 1;
    loadEpisode(nextEp); // loadEpisode関数がある前提
}
function goToPrevEpisode() {
    const prevEp = parseInt(state.currentEpisode) - 1;
    if (prevEp > 0) loadEpisode(prevEp);
}

// --- ナビゲーション制御（二重発火防止 & エピソード跨ぎ） ---
 let isProcessing = false;
async function handleNavigation(direction) {
        if (isProcessing) return;
        isProcessing = true;

        // 🌟 修正：HUDが表示されている場合のみ、非表示にする
        // これにより、連打して読み進めている最中に何度も非表示処理が走るのを防ぎます
        if (state.isHUDVisible) {
            toggleHUD(false);
        }

        if (direction === 'next') {
            if (state.sceneIndex < state.episodeData.length - 1) {
                nextScene();
            } else {
                await navigateToNeighbor('next');
            }
        } else {
            if (state.sceneIndex > 0) {
                prevScene();
            } else {
                await navigateToNeighbor('prev');
            }
        }
        
        setTimeout(() => { isProcessing = false; }, 300);
    }

    async function navigateToNeighbor(direction) {
        const currentIndex = state.episodeNumbers.indexOf(parseInt(state.currentEpisodeId));
        if (currentIndex === -1) return;

        const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

        if (targetIndex >= 0 && targetIndex < state.episodeNumbers.length) {
            const targetEp = state.episodeNumbers[targetIndex];
            
            // 次のエピソードなら0ページ目、前なら最後のページ
            const startIdx = (direction === 'next') ? 0 : 9999; 
            await loadEpisodeData(targetEp, startIdx);
            
            // 前のエピソードに戻った場合、最後のシーンインデックスに再調整
            if (direction === 'prev') {
                state.sceneIndex = state.episodeData.length - 1;
                renderScene(state.episodeData[state.sceneIndex]);
            }
        } else {
            console.log("エピソードの端です");
        }
    }


