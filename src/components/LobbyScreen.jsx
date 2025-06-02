// src/components/LobbyScreen.jsx
import React from 'react';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { User, Users, Users2, Info, HelpCircle } from 'lucide-react';
import { db, appId } from '../firebase'; // Assuming firebase.js is in src/

const LobbyScreen = ({ setGameMode, setScreen, userId }) => {
    const handleModeSelect = async (mode, gameType = "standard") => {
        if (!userId) {
            const notificationArea = document.getElementById('notification-area');
            if (notificationArea) {
                notificationArea.textContent = "ユーザーIDが取得できませんでした。ページをリロードしてください。";
                notificationArea.className = 'fixed top-5 right-5 bg-red-500 text-white p-3 rounded-md shadow-lg z-50';
                setTimeout(() => { notificationArea.className += ' hidden'; }, 3000);
            }
            return;
        }
        setGameMode(mode); // mode is '2player' or '4player'

        const gamesRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames`);
        let gameIdToJoin = null;
        const requiredPlayerCount = mode === '2player' ? 2 : (gameType === "extra" ? 4 : 4);

        const q = query(gamesRef, where("mode", "==", mode), where("gameType", "==", gameType), where("status", "==", "waiting"));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            for (const gameDoc of querySnapshot.docs) {
                const gameData = gameDoc.data();
                if (gameData.players.length < requiredPlayerCount && !gameData.players.includes(userId)) {
                    gameIdToJoin = gameDoc.id;
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameIdToJoin), {
                        players: arrayUnion(userId),
                        status: gameData.players.length + 1 === requiredPlayerCount ? "creating" : "waiting"
                    });
                    break;
                }
            }
        }

        if (!gameIdToJoin) {
            try {
                const newGameRef = await addDoc(gamesRef, {
                    mode: mode,
                    gameType: gameType,
                    status: "waiting",
                    players: [userId],
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
                    gameTimerEnd: gameType === "extra" ? serverTimestamp() /* Placeholder, will be set to Date.now() + limit */ : null,
                    secretObjectivesPool: gameType === "extra" ? [] : [], // Will be populated from constants
                    alliances: [],
                    declarations: gameType === "extra" ? {} : null,
                    roundActionOrder: gameType === "extra" ? [] : null,
                    phaseTimerEnd: null,
                    actionLog: gameType === "extra" ? [] : null,
                    traps: gameType === "extra" ? [] : null,
                    specialEventActive: null,
                });
                gameIdToJoin = newGameRef.id;
                 if (gameType === "extra") { // Set proper gameTimerEnd for extra mode
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameIdToJoin), {
                        gameTimerEnd: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000)
                    });
                }
            } catch (error) {
                console.error("Error creating game:", error);
                const notificationArea = document.getElementById('notification-area');
                if (notificationArea) {
                    notificationArea.textContent = "ゲームの作成に失敗しました。";
                    notificationArea.className = 'fixed top-5 right-5 bg-red-500 text-white p-3 rounded-md shadow-lg z-50';
                    setTimeout(() => { notificationArea.className += ' hidden'; }, 3000);
                }
                return;
            }
        }

        localStorage.setItem('labyrinthGameId', gameIdToJoin);
        localStorage.setItem('labyrinthGameType', gameType);
        setScreen('courseCreation');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white p-4">
            <div id="notification-area" className="fixed top-5 right-5 bg-red-500 text-white p-3 rounded-md shadow-lg hidden z-50"></div>
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
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-150 ease-in-out transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2">
                        <Users size={24} /> <span>4人対戦 (通常)</span>
                    </button>
                     <button onClick={() => handleModeSelect('4player', 'extra')}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-150 ease-in-out transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2">
                        <Users2 size={24} /> <span>4人対戦 (エクストラ)</span>
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
