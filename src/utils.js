/**
 * ユーティリティ関数集
 * アプリケーション全体で共通して使用される汎用的な関数を定義
 */

/**
 * 配列をランダムにシャッフルする関数（Fisher-Yatesアルゴリズム）
 * @param {Array} array - シャッフルする配列
 * @returns {Array} シャッフルされた配列
 */
export function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    
    // 配列の末尾から開始して、各要素をランダムな位置と交換
    while (currentIndex !== 0) {
        // 残りの要素からランダムに選択
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        
        // 要素を入れ替え（ES6分割代入を使用）
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }
    return array;
}

/**
 * 指定したグリッドサイズの初期壁情報を生成する関数
 * @param {number} gridSize - 迷路のグリッドサイズ
 * @returns {Array} 壁の配列（すべて非アクティブ状態）
 */
export const createInitialWallStates = (gridSize) => {
    const walls = [];
    
    // 横方向の壁を生成（セル間の水平な壁）
    for (let r = 0; r < gridSize - 1; r++) {
        for (let c = 0; c < gridSize; c++) {
            walls.push({ r, c, type: 'horizontal', active: false });
        }
    }
    
    // 縦方向の壁を生成（セル間の垂直な壁）
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize - 1; c++) {
            walls.push({ r, c, type: 'vertical', active: false });
        }
    }
    
    return walls;
};

/**
 * スタートからゴールまで壁を考慮して到達可能か判定する関数
 * 幅優先探索（BFS）を使用してパスの存在を確認
 * @param {Object} start - スタート位置 {r, c}
 * @param {Object} goal - ゴール位置 {r, c}
 * @param {Array} walls - 壁の配列
 * @param {number} gridSize - グリッドサイズ
 * @returns {boolean} パスが存在するかどうか
 */
export const isPathPossible = (start, goal, walls, gridSize) => {
    if (!start || !goal) return false;
    
    // BFS用のキューと訪問済みセットを初期化
    const queue = [[start.r, start.c]];
    const visited = new Set([`${start.r}-${start.c}`]);
    
    // 移動方向：右、左、下、上
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        
        // ゴールに到達したら成功
        if (r === goal.r && c === goal.c) return true;

        // 各方向への移動を試行
        for (const [dr, dc] of directions) {
            const nr = r + dr;  // 新しい行
            const nc = c + dc;  // 新しい列

            // グリッド範囲内かつ未訪問かチェック
            if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize && !visited.has(`${nr}-${nc}`)) {
                let wallExists = false;
                
                // 移動方向に応じて壁の存在をチェック
                if (dr === 0) { // 横移動の場合（左右）
                    const wallC = Math.min(c, nc);
                    if (walls.find(w => w.type === 'vertical' && w.r === r && w.c === wallC && w.active)) {
                        wallExists = true;
                    }
                } else { // 縦移動の場合（上下）
                    const wallR = Math.min(r, nr);
                     if (walls.find(w => w.type === 'horizontal' && w.r === wallR && w.c === c && w.active)) {
                        wallExists = true;
                    }
                }
                
                // 壁がない場合、その位置をキューに追加
                if (!wallExists) {
                    visited.add(`${nr}-${nc}`);
                    queue.push([nr, nc]);
                }
            }
        }
    }
    
    // すべての可能な位置を探索してもゴールに到達できない場合
    return false;
};

/**
 * 秒数を分:秒形式にフォーマットする関数
 * @param {number} seconds - 秒数
 * @returns {string} MM:SS形式の文字列
 */
export const formatTime = (seconds) => {
    if (seconds === null || seconds < 0) return "--:--";
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    // 0埋めして2桁で表示
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
