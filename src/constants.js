/**
 * アプリケーション全体で使用される定数定義ファイル
 * ゲームの設定値、イベント、目標、妨害・交渉の種類などを管理
 */

// === ゲーム基本設定 ===
export const STANDARD_GRID_SIZE = 6;  // 標準の迷路グリッドサイズ
export const EXTRA_GRID_SIZE = 11;    // 拡張モードでの迷路グリッドサイズ
export const WALL_COUNT = 20;         // 迷路内の壁の数

// === 時間制限設定 ===
export const DECLARATION_PHASE_DURATION = 30; // 宣言フェーズの時間（秒）
export const ACTION_EXECUTION_DELAY = 1500;   // アクション実行間の遅延（ミリ秒）
export const RESULT_PUBLICATION_DURATION = 10; // 結果公開の時間（秒）
export const CHAT_PHASE_DURATION = 60;         // チャットフェーズの時間（秒）
export const EXTRA_MODE_TOTAL_TIME_LIMIT = 30 * 60;     // 拡張モード全体の時間制限（30分）
export const EXTRA_MODE_PERSONAL_TIME_LIMIT = 10 * 60;  // 拡張モード個人時間制限（10分）

// === ペナルティ設定 ===
export const PERSONAL_TIME_PENALTY_INTERVAL = 30; // 個人時間ペナルティ間隔（秒）
export const PERSONAL_TIME_PENALTY_POINTS = -5;   // 個人時間ペナルティポイント
export const DECLARATION_TIMEOUT_PENALTY = -5;    // 宣言タイムアウトペナルティ
export const ALLIANCE_VIOLATION_PENALTY = -15;    // 同盟違反ペナルティ

// === 特別イベント設定 ===
export const SPECIAL_EVENT_INTERVAL_ROUNDS = 3; // 特別イベント発生間隔（ラウンド数）

// === 特別イベント定義 ===
export const SPECIAL_EVENTS = [
    { 
        id: "information_leak", 
        name: "情報漏洩", 
        description: "全プレイヤーの現在位置が1ターン公開されます！" 
    },
    { 
        id: "communication_jam", 
        name: "通信妨害", 
        description: "このラウンドのチャットフェーズはチャットが使用不可になります！" 
    },
    { 
        id: "maze_shift", 
        name: "迷宮変化", 
        description: "各プレイヤーが攻略中の迷宮の壁が一部ランダムに変化します！" 
    },
];

// === 秘密目標定義 ===
export const SECRET_OBJECTIVES = [
    { 
        id: "COMP_FIRST_GOAL", 
        text: "誰よりも早く1位でゴールする (同盟なしの場合)", 
        type: "competitive", 
        points: 20, 
        gameEndCondition: false, 
        immediateCheckOnGoal: true 
    },
    { 
        id: "COMP_TARGET_LAST", 
        text: "特定のプレイヤーを最下位にする", 
        type: "competitive", 
        requiresTarget: true, 
        points: 20, 
        gameEndCondition: true 
    },
    { 
        id: "COMP_SOLO_TOP3", 
        text: "誰とも同盟せずに上位3位以内でゴールする", 
        type: "competitive", 
        points: 20, 
        gameEndCondition: true 
    },
    { 
        id: "COOP_ALLY_TOP2", 
        text: "特定のプレイヤーと同盟し、共に上位2位以内でゴールする", 
        type: "cooperative", 
        requiresTarget: true, 
        points: 20, 
        gameEndCondition: true 
    },
    { 
        id: "COOP_LARGE_ALLIANCE", 
        text: "3人以上の同盟を成立させる", 
        type: "cooperative", 
        points: 20, 
        immediateCheck: true 
    },
    { 
        id: "SAB_OBSTRUCT_THRICE", 
        text: "他プレイヤーに3回以上妨害を成功させる", 
        type: "sabotage", 
        points: 20, 
        counterMax: 3, 
        immediateCheck: true 
    },
    { 
        id: "SAB_BETRAY_AND_WIN", 
        text: "同盟を裏切り、その相手より上位でゴールする", 
        type: "sabotage", 
        requiresTarget: true, 
        points: 15, 
        gameEndCondition: true 
    },
];

// === 妨害行動の種類定義 ===
export const SABOTAGE_TYPES = [
    { 
        id: "trap", 
        label: "トラップ設置", 
        description: "指定座標に1ターン有効なトラップを設置。踏むと1ターン行動不能。", 
        needsCoordinate: true, 
        iconName: "Skull" 
    },
    { 
        id: "confusion", 
        label: "混乱攻撃", 
        description: "対象の次回移動をランダム方向に変更 (成功率70%)。", 
        needsPlayerTarget: true, 
        iconName: "RefreshCw" 
    },
    { 
        id: "info_jam", 
        label: "情報妨害", 
        description: "対象のチャット送信を1ターン無効化。", 
        needsPlayerTarget: true, 
        iconName: "MessageSquare" 
    },
];

// === 交渉・同盟の種類定義 ===
export const NEGOTIATION_TYPES = [
    { 
        id: "non_aggression", 
        label: "相互不可侵条約", 
        duration: 3, 
        description: "互いに妨害不可。基本位置共有。", 
        iconName: "ShieldCheck", 
        sharesPosition: true, 
        sharesWalls: false, 
        sharesScout: false 
    },
    { 
        id: "information_sharing", 
        label: "情報共有同盟", 
        duration: 5, 
        description: "壁・偵察情報共有。連携移動ボーナス。", 
        iconName: "Eye", 
        sharesPosition: true, 
        sharesWalls: true, 
        sharesScout: true 
    },
    { 
        id: "full_alliance", 
        label: "完全同盟", 
        duration: Infinity, 
        description: "全情報共有。合同作戦。勝利ポイント分配(50%)。", 
        iconName: "Users2", 
        sharesPosition: true, 
        sharesWalls: true, 
        sharesScout: true 
    },
    { 
        id: "betrayal", 
        label: "裏切り宣言", 
        duration: 0, 
        description: "現在の同盟を破棄。ボーナスあり。", 
        iconName: "ShieldOff" 
    }
];
