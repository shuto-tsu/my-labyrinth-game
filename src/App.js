// src/App.js
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, appId } from './firebase'; // Firebase設定をインポート

import LobbyScreen from './components/LobbyScreen';
import CourseCreationScreen from './components/CourseCreationScreen';
import PlayScreen from './components/PlayScreen';
// import './App.css'; // App固有のスタイルがあれば

function App() {
    const [screen, setScreen] = useState('lobby'); // lobby, courseCreation, play
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [gameMode, setGameMode] = useState('2player'); // '2player' or '4player' (standard)
    // gameType ('standard' or 'extra') は localStorage や Firestore から読み込まれる想定

    useEffect(() => {
        const initAuth = async () => {
            try {
                 onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        // For environments where __initial_auth_token is provided (like Canvas)
                        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
                            try {
                                await signInWithCustomToken(auth, window.__initial_auth_token);
                                // onAuthStateChanged will be triggered again with the new user
                            } catch (customTokenError) {
                                console.error("Error signing in with custom token, falling back to anonymous:", customTokenError);
                                await signInAnonymously(auth);
                            }
                        } else {
                            await signInAnonymously(auth);
                        }
                    }
                    setIsAuthReady(true);
                });
            } catch (error) {
                console.error("Firebase Auth Error:", error);
                setIsAuthReady(true); 
            }
        };
        initAuth();
    }, []);
    
    useEffect(() => { // Resume game logic
        if(isAuthReady && userId) {
            const storedGameId = localStorage.getItem('labyrinthGameId');
            // const storedGameType = localStorage.getItem('labyrinthGameType'); // gameType is primarily managed by PlayScreen/CourseCreationScreen via Firestore
            if (storedGameId) {
                const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, storedGameId);
                getDoc(gameDocRef).then(docSnap => {
                    if (docSnap.exists()) {
                        const game = docSnap.data();
                        if (!game.players || !game.players.includes(userId)) {
                             localStorage.removeItem('labyrinthGameId');
                             localStorage.removeItem('labyrinthGameType'); // Clear type as well
                             return;
                        }
                        setGameMode(game.mode); // This is '2player' or '4player'
                        
                        if (game.status === "creating") {
                             setScreen('courseCreation');
                        } else if (game.status === "playing" || game.status === "finished" || (game.gameType === "extra" && game.currentExtraModePhase)) {
                             setScreen('play'); 
                        } else { // waiting or other states not suitable for direct resume
                            localStorage.removeItem('labyrinthGameId');
                            localStorage.removeItem('labyrinthGameType');
                        }
                    } else { // Game document doesn't exist
                        localStorage.removeItem('labyrinthGameId');
                        localStorage.removeItem('labyrinthGameType');
                    }
                }).catch(error => {
                    console.error("Error checking for existing game:", error);
                    localStorage.removeItem('labyrinthGameId');
                    localStorage.removeItem('labyrinthGameType');
                });
            }
        }
    }, [isAuthReady, userId]);

    if (!isAuthReady) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-800 text-white text-xl">認証情報を読み込み中...</div>;
    }

    if (!userId && isAuthReady) { // Ensure auth is ready before showing error
         return <div className="flex items-center justify-center min-h-screen bg-slate-800 text-white text-xl">認証に失敗しました。ページをリロードしてください。</div>;
    }

    switch (screen) {
        case 'courseCreation':
            return <CourseCreationScreen userId={userId} setScreen={setScreen} gameMode={gameMode} />;
        case 'play':
            // PlayScreen will internally handle gameType based on Firestore data
            return <PlayScreen userId={userId} setScreen={setScreen} gameMode={gameMode}  />; 
        case 'lobby':
        default:
            return <LobbyScreen setGameMode={setGameMode} setScreen={setScreen} userId={userId} />;
    }
}

export default App;
