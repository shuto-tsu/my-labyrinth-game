/**
 * ロビー画面コンポーネント
 * ゲームモードの選択、ゲームの作成・参加機能を提供
 */

import React from 'react';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { User, Users, Users2, Info, HelpCircle } from 'lucide-react';
import { db, appId } from '../firebase';
import { EXTRA_MODE_TOTAL_TIME_LIMIT, SECRET_OBJECTIVES } from '../constants';

/**
 * ロビー画面コンポーネント
 * @param {Function} setGameMode - ゲームモードを設定する関数
 * @param {Function} setScreen - 画面を切り替える関数
 * @param {string} userId - 現在のユーザーID
 * @param {boolean} debugMode - デバッグモードのON/OFF
 */
const LobbyScreen = ({ setGameMode, setScreen, userId, debugMode }) => {
    
    /**
     * デバッグ用の4人分のプレイヤーID生成
     * @returns {Array} プレイヤーIDの配列
     */
    const generateDebugPlayerIds = () => {
        return [
            userId,
            `debug_player_2_${Date.now()}`,
            `debug_player_3_${Date.now()}`,
            `debug_player_4_${Date.now()}`
        ];
    };

    /**
     * モード選択時の処理
     * @param {string} mode - ゲームモード（2player or 4player）
     * @param {string} gameType - ゲームタイプ（standard or extra）
     */
    const handleModeSelect = async (mode, gameType = "standard") => {
        console.log("🎯 [DEBUG] Mode selected:", { mode, gameType, userId, debugMode });
        
        // ユーザーIDのチェック
        if (!userId) {
            console.error("❌ [DEBUG] No userId available");
            const notificationArea = document.getElementById('notification-area');
            if (notificationArea) {
                notificationArea.textContent = "ユーザーIDが取得できませんでした。ページをリロードしてください。";
                notificationArea.className = 'fixed top-5 right-5 bg-red-500 text-white p-3 rounded-md shadow-lg z-50';
                setTimeout(() => { notificationArea.className += ' hidden'; }, 3000);
            }
            return;
        }
        
        // ゲームモードを設定
        setGameMode(mode);

        // Firestoreのゲームコレクションを取得
        const gamesRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames`);
        let gameIdToJoin = null;
        
        // 必要なプレイヤー数を決定
        const requiredPlayerCount = mode === '2player' ? 2 : (gameType === "extra" ? 4 : 4);
        
        console.log("🔍 [DEBUG] Searching for existing games:", { mode, gameType, requiredPlayerCount });

        // デバッグモードの場合、待機中のゲームをスキップして新規作成
        if (!debugMode) {
            // 待機中のゲームを検索
            const q = query(gamesRef, where("mode", "==", mode), where("gameType", "==", gameType), where("status", "==", "waiting"));
            const querySnapshot = await getDocs(q);

            console.log("🔍 [DEBUG] Found", querySnapshot.size, "waiting games");

            if (!querySnapshot.empty) {
                // 既存の待機中ゲームがある場合の処理
                for (const gameDoc of querySnapshot.docs) {
                    const gameData = gameDoc.data();
                    console.log("🔍 [DEBUG] Checking game:", {
                        id: gameDoc.id,
                        players: gameData.players,
                        playerCount: gameData.players.length,
                        includesCurrentUser: gameData.players.includes(userId)
                    });
                    
                    if (gameData.players.length < requiredPlayerCount && !gameData.players.includes(userId)) {
                        gameIdToJoin = gameDoc.id;
                        console.log("✅ [DEBUG] Joining existing game:", gameIdToJoin);
                        
                        await updateDoc(doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameIdToJoin), {
                            players: arrayUnion(userId),
                            status: gameData.players.length + 1 === requiredPlayerCount ? "creating" : "waiting"
                        });
                        
                        console.log("✅ [DEBUG] Successfully joined game. New status:", gameData.players.length + 1 === requiredPlayerCount ? "creating" : "waiting");
                        break;
                    }
                }
            }
        } else {
            console.log("🔧 [DEBUG] Debug mode: Skipping existing games, creating new one");
        }

        if (!gameIdToJoin) {
            console.log("🆕 [DEBUG] Creating new game");
            try {
                // デバッグモードの場合、4人分のプレイヤーIDを事前に設定
                const playersArray = debugMode && (mode === '4player') ? generateDebugPlayerIds() : [userId];
                const gameStatus = debugMode && (mode === '4player') ? "creating" : "waiting";
                
                const newGameData = {
                    mode: mode,
                    gameType: gameType,
                    status: gameStatus,
                    players: playersArray,
                    hostId: userId,
                    createdAt: serverTimestamp(),
                    currentTurnPlayerId: null,
                    turnOrder: [],
                    mazes: {},
                    playerStates: {},
                    goalCount: 0,
                    playerGoalOrder: [],
                    activeBattle: null,
                    chatMessagesLastFetch: null,
                    currentExtraModePhase: gameType === "extra" ? "mazeCreation" : null,
                    roundNumber: gameType === "extra" ? 1 : null,
                    gameTimerEnd: gameType === "extra" ? Timestamp.fromMillis(Date.now() + EXTRA_MODE_TOTAL_TIME_LIMIT * 1000) : null,
                    secretObjectivesPool: gameType === "extra" ? SECRET_OBJECTIVES : [],
                    alliances: [],
                    declarations: gameType === "extra" ? {} : null,
                    roundActionOrder: gameType === "extra" ? [] : null,
                    phaseTimerEnd: null,
                    actionLog: gameType === "extra" ? [] : null,
                    traps: gameType === "extra" ? [] : null,
                    specialEventActive: null,
                    debugMode: debugMode // デバッグモードフラグを追加
                };
                
                console.log("🆕 [DEBUG] New game data:", newGameData);
                
                const newGameRef = await addDoc(gamesRef, newGameData);
                gameIdToJoin = newGameRef.id;
                
                console.log("✅ [DEBUG] Successfully created new game:", gameIdToJoin);
                
                // Ensure gameTimerEnd is properly set for extra mode after creation
                if (gameType === "extra") {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameIdToJoin), {
                        gameTimerEnd: Timestamp.fromMillis(Date.now() + EXTRA_MODE_TOTAL_TIME_LIMIT * 1000)
                    });
                    console.log("✅ [DEBUG] Set gameTimerEnd for extra mode");
                }
            } catch (error) {
                console.error("❌ [DEBUG] Error creating game:", error);
                const notificationArea = document.getElementById('notification-area');
                if (notificationArea) {
                    notificationArea.textContent = "ゲームの作成に失敗しました。";
                    notificationArea.className = 'fixed top-5 right-5 bg-red-500 text-white p-3 rounded-md shadow-lg z-50';
                    setTimeout(() => { notificationArea.className += ' hidden'; }, 3000);
                }
                return;
            }
        }

        console.log("💾 [DEBUG] Storing game info in localStorage:", { gameIdToJoin, gameType });
        localStorage.setItem('labyrinthGameId', gameIdToJoin);
        localStorage.setItem('labyrinthGameType', gameType);
        
        console.log("🚀 [DEBUG] Redirecting to course creation");
        setScreen('courseCreation');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white p-4">
            <div id="notification-area" className="fixed top-5 right-5 bg-red-500 text-white p-3 rounded-md shadow-lg hidden z-50"></div>
            
            {/* デバッグモード表示 */}
            {debugMode && (
                <div className="fixed top-5 left-5 bg-orange-500 text-white p-3 rounded-md shadow-lg z-50">
                    <div className="flex items-center space-x-2">
                        <span className="text-lg">🔧</span>
                        <span className="font-bold">DEBUG MODE</span>
                    </div>
                    <p className="text-xs mt-1">4人対戦を一人でテスト可能</p>
                </div>
            )}
            
            <header className="text-center mb-12">
                <h1 className="text-5xl font-bold tracking-tight mb-2">ラビリンス</h1>
                <p className="text-xl text-slate-300">心理戦迷路ゲーム</p>
                {userId && <p className="text-sm text-slate-400 mt-2">ユーザーID: {userId.substring(0,12)}...</p>}
            </header>

            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h2 className="text-3xl font-semibold mb-8 text-center text-sky-400">モード選択</h2>
                <div className="space-y-6">
                    <button onClick={() => handleModeSelect('2player', 'standard')}
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-150 ease-in-out transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2">
                        <User size={24} /> <span>2人対戦 (通常)</span>
                    </button>
                    <button onClick={() => handleModeSelect('4player', 'standard')}
                        className={`w-full ${debugMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-teal-500 hover:bg-teal-600'} text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-150 ease-in-out transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2`}>
                        <Users size={24} /> 
                        <span>4人対戦 (通常) {debugMode && '🔧'}</span>
                    </button>
                     <button onClick={() => handleModeSelect('4player', 'extra')}
                        className={`w-full ${debugMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'} text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-150 ease-in-out transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2`}>
                        <Users2 size={24} /> 
                        <span>4人対戦 (エクストラ) {debugMode && '🔧'}</span>
                    </button>
                </div>
            </div>

            <footer className="mt-12 text-center text-slate-400 space-x-4">
                 <button onClick={() => {
                    const notificationArea = document.getElementById('notification-area');
                    if (notificationArea) {
                        notificationArea.innerHTML = "<strong>遊び方：</strong><br>各モードのルールに従ってプレイしてください。<br>エクストラモードはより複雑な戦略が必要です。";
                        notificationArea.className = 'fixed top-5 right-5 bg-blue-500 text-white p-3 rounded-md shadow-lg z-50 text-sm';
                        setTimeout(() => {notificationArea.className += ' hidden'; }, 6000);
                    }
                }} className="hover:text-sky-400 transition-colors"><Info size={20} className="inline mr-1"/> 遊び方</button>
                <button onClick={() => {
                     const notificationArea = document.getElementById('notification-area');
                     if (notificationArea) {
                        notificationArea.innerHTML = "<strong>ヘルプ：</strong><br>問題発生時はリロードしてください。";
                        notificationArea.className = 'fixed top-5 right-5 bg-blue-500 text-white p-3 rounded-md shadow-lg z-50 text-sm';
                        setTimeout(() => {notificationArea.className += ' hidden'; }, 4000);
                    }
                }} className="hover:text-sky-400 transition-colors"><HelpCircle size={20} className="inline mr-1"/> ヘルプ</button>
            </footer>
        </div>
    );
};

export default LobbyScreen;
