// src/components/PlayScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, increment, Timestamp, runTransaction, collection, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, EyeOff, MessageSquare, Send, Users, User, Settings, Play, Info, HelpCircle, CheckCircle, XCircle, Swords, Shield, Crown, RefreshCw, ListChecks, MinusCircle, PlusCircle, Award, Target, Clock, Users2, Shuffle, Handshake, Zap, Search, Move, Hourglass, ThumbsUp, ThumbsDown, Flag, Skull, MapPin, UserCheck, UserX, ShieldCheck, ShieldOff, InfoIcon, AlertTriangle, GitPullRequestArrow, Sparkles, TimerIcon, TrendingUp, TrendingDown, Trophy, Megaphone, MicOff } from 'lucide-react';

import { db, appId } from '../firebase';
import MazeGrid from './MazeGrid';
import BattleModal from './BattleModal'; // Assuming standard battle modal is separate
import GameOverModal from './GameOverModal';
import { STANDARD_GRID_SIZE, EXTRA_GRID_SIZE, NEGOTIATION_TYPES, SABOTAGE_TYPES, DECLARATION_PHASE_DURATION, CHAT_PHASE_DURATION, RESULT_PUBLICATION_DURATION, ACTION_EXECUTION_DELAY, EXTRA_MODE_TOTAL_TIME_LIMIT, EXTRA_MODE_PERSONAL_TIME_LIMIT, PERSONAL_TIME_PENALTY_INTERVAL, PERSONAL_TIME_PENALTY_POINTS, DECLARATION_TIMEOUT_PENALTY, ALLIANCE_VIOLATION_PENALTY, SPECIAL_EVENT_INTERVAL_ROUNDS, SPECIAL_EVENTS } from '../constants';
import { formatTime, isPathPossible, shuffleArray } from '../utils';

const PlayScreen = ({ userId, setScreen, gameMode }) => {
    const [gameId, setGameId] = useState(null);
    const [gameData, setGameData] = useState(null);
    const [myPlayerState, setMyPlayerState] = useState(null);
    const [mazeToPlayData, setMazeToPlayData] = useState(null);
    const [myCreatedMazeData, setMyCreatedMazeData] = useState(null);
    const [playerSolvingMyMaze, setPlayerSolvingMyMaze] = useState(null);
    const [message, setMessage] = useState("ゲーム開始！");
    const [showOpponentWallsDebug, setShowOpponentWallsDebug] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const chatLogRef = useRef(null);
    const [isBattleModalOpen, setIsBattleModalOpen] = useState(false); // For standard mode battle
    const [battleOpponentId, setBattleOpponentId] = useState("");
    const [gameType, setGameType] = useState('standard');
    const [phaseTimeLeft, setPhaseTimeLeft] = useState(null);
    const [overallTimeLeft, setOverallTimeLeft] = useState(null);
    const [selectedAction, setSelectedAction] = useState(null);
    const [actionTarget, setActionTarget] = useState(null);
    const [sabotageType, setSabotageType] = useState(null);
    const [negotiationDetails, setNegotiationDetails] = useState({ type: null, duration: null, conditions: ""});
    const [showActionDetails, setShowActionDetails] = useState(false);
    const [trapPlacementCoord, setTrapPlacementCoord] = useState(null);
    const [isPlacingTrap, setIsPlacingTrap] = useState(false);
    const [sharedWalls, setSharedWalls] = useState([]);
    const [sharedScoutLogs, setSharedScoutLogs] = useState([]);
    const personalTimerIntervalRef = useRef(null);
    const [isGameOverModalOpen, setIsGameOverModalOpen] = useState(false);
    const [actionLog, setActionLog] = useState([]);


    useEffect(() => { if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight; }, [chatMessages]);
    useEffect(() => {
        const storedGameId = localStorage.getItem('labyrinthGameId');
        const storedGameType = localStorage.getItem('labyrinthGameType') || 'standard';
        setGameType(storedGameType);
        if (storedGameId) setGameId(storedGameId);
        else setScreen('lobby');
    }, [setScreen]);

    const currentGridSize = gameType === 'extra' ? EXTRA_GRID_SIZE : STANDARD_GRID_SIZE;

    const sendSystemChatMessage = useCallback(async (text) => {
        if (!gameId) return;
        const chatCollRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames/${gameId}/chatMessages`);
        try {
            await addDoc(chatCollRef, { senderId: "system", senderName: "システム", text: text, timestamp: serverTimestamp() });
        } catch (error) { console.error("Error sending system chat message:", error); }
    }, [gameId, appId]);

    const finalizeGameExtraMode = useCallback(async (gId, currentGData) => { /* ... (Implementation from previous step) ... */ 
        if (!gId || !currentGData || currentGData.status === 'finished') return;
        sendSystemChatMessage("ゲーム終了！最終ポイント計算中...");
        const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gId);
        try {
            await runTransaction(db, async (transaction) => {
                const freshGameSnap = await transaction.get(gameDocRef);
                if (!freshGameSnap.exists()) throw "Game not found for finalization!";
                const freshGData = freshGameSnap.data();
                if (freshGData.status === 'finished') return; 
                let finalPlayerStates = JSON.parse(JSON.stringify(freshGData.playerStates)); 
                freshGData.players.forEach(pid => {
                    const pState = finalPlayerStates[pid];
                    if (pState.personalTimeUsed > EXTRA_MODE_PERSONAL_TIME_LIMIT) {
                        const overtimeSeconds = pState.personalTimeUsed - EXTRA_MODE_PERSONAL_TIME_LIMIT;
                        const penaltyCount = Math.floor(overtimeSeconds / PERSONAL_TIME_PENALTY_INTERVAL);
                        if (penaltyCount > 0) { const totalPenalty = penaltyCount * PERSONAL_TIME_PENALTY_POINTS; pState.score += totalPenalty; }
                    }
                    finalPlayerStates[pid].scoreBeforeFullAllianceBonus = pState.score;
                });
                let rankedPlayers = freshGData.players.map(pid => ({ id: pid, score: finalPlayerStates[pid].score || 0, goalTime: finalPlayerStates[pid].goalTime ? (finalPlayerStates[pid].goalTime.toMillis ? finalPlayerStates[pid].goalTime.toMillis() : finalPlayerStates[pid].goalTime) : Infinity, allianceId: finalPlayerStates[pid].allianceId, secretObjective: finalPlayerStates[pid].secretObjective, betrayedAllies: finalPlayerStates[pid].betrayedAllies || [], })).sort((a, b) => { if (a.goalTime !== b.goalTime) return a.goalTime - b.goalTime; return b.score - a.score; });
                rankedPlayers.forEach((p, index) => { finalPlayerStates[p.id].rank = index + 1; });
                const goalPointsExtra = [50, 30, 20, 10];
                rankedPlayers.forEach((p, index) => { if (p.goalTime !== Infinity) { finalPlayerStates[p.id].score += goalPointsExtra[index] || 0; } });
                freshGData.players.forEach(pid => {
                    const pState = finalPlayerStates[pid]; const objective = pState.secretObjective;
                    if (objective && !objective.achieved && objective.gameEndCondition) {
                        let achievedNow = false;
                        switch(objective.id) {
                            case "COMP_TARGET_LAST": if (objective.targetPlayerId && finalPlayerStates[objective.targetPlayerId]?.rank === freshGData.players.length) achievedNow = true; break;
                            case "COMP_SOLO_TOP3": if (!pState.allianceId && pState.rank <= 3) achievedNow = true; break; 
                            case "COOP_ALLY_TOP2": if (pState.allianceId && objective.targetPlayerId && finalPlayerStates[objective.targetPlayerId]?.allianceId === pState.allianceId && pState.rank <= 2 && finalPlayerStates[objective.targetPlayerId]?.rank <= 2) achievedNow = true; break;
                            case "SAB_BETRAY_AND_WIN": if (pState.betrayedAllies.length > 0) { const higherThanAllBetrayed = pState.betrayedAllies.every(bAllyId => finalPlayerStates[bAllyId] ? pState.rank < finalPlayerStates[bAllyId].rank : true); if (higherThanAllBetrayed) achievedNow = true; } break;
                        }
                        if (achievedNow) { pState.score += objective.points; pState.secretObjective.achieved = true; /* systemMsg */ }
                    }
                    if (pState.allianceId) { const currentAlliance = freshGData.alliances.find(a => a.id === pState.allianceId && a.status !== 'betrayed'); if (currentAlliance) { const higherAlly = currentAlliance.members.find(memberId => memberId !== pid && finalPlayerStates[memberId] && finalPlayerStates[memberId].rank < pState.rank); if (higherAlly) { pState.score += 10; /* systemMsg */ } } }
                    const wasEverAllied = freshGData.alliances.some(a => a.members.includes(pid)); if (pState.rank === 1 && !wasEverAllied) { pState.score += 25; /* systemMsg */ }
                });
                const fullAlliances = freshGData.alliances.filter(a => a.type === 'full_alliance' && a.status !== 'betrayed');
                fullAlliances.forEach(alliance => {
                    const memberStatesInAlliance = alliance.members.map(pid => finalPlayerStates[pid]).filter(Boolean);
                    if (memberStatesInAlliance.length > 0) {
                        const totalScoreOfMembersForDistribution = memberStatesInAlliance.reduce((sum, pState) => sum + (pState.scoreBeforeFullAllianceBonus !== undefined ? pState.scoreBeforeFullAllianceBonus : pState.score), 0);
                        const pointsToDistribute = Math.floor(totalScoreOfMembersForDistribution * 0.5);
                        const sharePerMember = memberStatesInAlliance.length > 0 ? Math.floor(pointsToDistribute / memberStatesInAlliance.length) : 0;
                        memberStatesInAlliance.forEach(pState => { const originalScoreForCalc = pState.scoreBeforeFullAllianceBonus !== undefined ? pState.scoreBeforeFullAllianceBonus : pState.score; finalPlayerStates[pState.id].score = Math.floor(originalScoreForCalc * 0.5) + sharePerMember; });
                    }
                });
                transaction.update(gameDocRef, { playerStates: finalPlayerStates, status: "finished", currentExtraModePhase: "gameOver", phaseTimerEnd: null, currentActionPlayerId: null, });
            });
        } catch (error) { console.error("Error finalizing game:", error); sendSystemChatMessage("ゲーム終了処理エラー: " + error.message); }
    }, [appId, sendSystemChatMessage]);

    const advanceExtraModePhase = useCallback(async (gId, currentGData) => { 
        if (!gId || !currentGData || currentGData.gameType !== 'extra' || currentGData.status === 'finished') return;
        const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gId);
        let updates = {}; let nextPhase = currentGData.currentExtraModePhase; let nextPhaseTimer = null; let nextActionPlayerId = null; let newRoundActionOrder = currentGData.roundActionOrder || [];
        try {
            if (currentGData.currentExtraModePhase === 'declaration') {
                nextPhase = 'priorityResolution'; const declaredActions = {...currentGData.declarations} || {}; // Clone to modify
                currentGData.players.forEach(pid => {
                    if (!declaredActions[pid]?.type) {
                        declaredActions[pid] = { type: 'wait', autoDeclared: true, submittedAt: serverTimestamp() };
                        updates[`playerStates.${pid}.score`] = increment(DECLARATION_TIMEOUT_PENALTY);
                        sendSystemChatMessage(`${pid.substring(0,5)}は時間切れで「待機」扱い、ペナルティ${DECLARATION_TIMEOUT_PENALTY}pt。`);
                    }
                });
                updates.declarations = declaredActions; 
                const priorities = { negotiate: 1, sabotage: 2, scout: 3, move: 4, wait: 5 };
                newRoundActionOrder = currentGData.players
                    .filter(pid => declaredActions[pid]?.type)
                    .map(pid => ({ playerId: pid, action: declaredActions[pid], priority: priorities[declaredActions[pid].type] || 99, boost: currentGData.playerStates[pid]?.temporaryPriorityBoost || 0, }))
                    .sort((a, b) => (a.priority - a.boost) - (b.priority - b.boost) || (a.action.submittedAt?.toMillis() || Date.now()) - (b.action.submittedAt?.toMillis() || Date.now())) 
                    .map(a => a.playerId);
                updates.roundActionOrder = newRoundActionOrder;
                currentGData.players.forEach(pid => { updates[`playerStates.${pid}.temporaryPriorityBoost`] = 0; });
                if (newRoundActionOrder.length > 0) { nextPhase = 'actionExecution'; nextActionPlayerId = newRoundActionOrder[0]; } else { nextPhase = 'chat'; nextPhaseTimer = Timestamp.fromMillis(Date.now() + CHAT_PHASE_DURATION * 1000); }
                sendSystemChatMessage(`優先度決定完了。実行順: ${newRoundActionOrder.map(p=>p.substring(0,5)).join(', ') || 'アクションなし'}`);
            } else if (currentGData.currentExtraModePhase === 'actionExecution') {
                const currentActionIndex = newRoundActionOrder.indexOf(currentGData.currentActionPlayerId);
                if (currentActionIndex < newRoundActionOrder.length - 1) { nextActionPlayerId = newRoundActionOrder[currentActionIndex + 1]; nextPhase = 'actionExecution'; }
                else { nextPhase = 'resultPublication'; nextPhaseTimer = Timestamp.fromMillis(Date.now() + RESULT_PUBLICATION_DURATION * 1000); sendSystemChatMessage("全アクション実行完了。結果発表フェーズへ。"); }
            } else if (currentGData.currentExtraModePhase === 'resultPublication') {
                nextPhase = 'chat'; nextPhaseTimer = Timestamp.fromMillis(Date.now() + CHAT_PHASE_DURATION * 1000); sendSystemChatMessage("結果発表終了。チャットフェーズへ。");
            } else if (currentGData.currentExtraModePhase === 'chat') {
                nextPhase = 'declaration'; updates.roundNumber = increment(1); updates.declarations = {}; 
                const currentRound = (currentGData.roundNumber || 0) + 1;
                updates.traps = (currentGData.traps || []).filter(trap => trap.expiryRound >= currentRound);
                currentGData.players.forEach(pid => { 
                    updates[`playerStates.${pid}.hasDeclaredThisTurn`] = false; 
                    updates.declarations[pid] = { type: null, submittedAt: null }; 
                    const activeEffects = (currentGData.playerStates[pid]?.sabotageEffects || []).filter(eff => eff.expiryRound >= currentRound);
                    updates[`playerStates.${pid}.sabotageEffects`] = activeEffects;
                });
                const activeAlliances = (currentGData.alliances || []).filter(ally => ally.durationTurns === Infinity || (ally.startRound + ally.durationTurns) > currentRound);
                updates.alliances = activeAlliances;
                currentGData.players.forEach(pid => {
                    const pState = currentGData.playerStates[pid];
                    if (pState.allianceId && !activeAlliances.find(a => a.id === pState.allianceId && a.members.includes(pid))) {
                        updates[`playerStates.${pid}.allianceId`] = null;
                        sendSystemChatMessage(`${pid.substring(0,5)}の同盟が期限切れで解消されました。`);
                    }
                });
                if (currentRound % SPECIAL_EVENT_INTERVAL_ROUNDS === 0) {
                    const event = SPECIAL_EVENTS[Math.floor(Math.random() * SPECIAL_EVENTS.length)];
                    updates.specialEventActive = { type: event.id, name: event.name, description: event.description, visibleUntilRound: currentRound }; 
                    sendSystemChatMessage(`特殊イベント発生: 「${event.name}」！ ${event.description}`);
                    if (event.id === 'maze_shift') {
                        const newMazesShifted = {...currentGData.mazes};
                        currentGData.players.forEach(pIdShift => {
                            const pStateShift = currentGData.playerStates[pIdShift];
                            const mazeOwnerShift = pStateShift.assignedMazeOwnerId;
                            if (newMazesShifted[mazeOwnerShift]) {
                                let currentWallsShift = newMazesShifted[mazeOwnerShift].allWallsConfiguration.map(w => ({...w}));
                                let wallChangeCount = 0;
                                for(let i=0; i < Math.min(5, currentWallsShift.length / 4) && wallChangeCount < 3; i++) { 
                                    const randWallIdx = Math.floor(Math.random() * currentWallsShift.length);
                                    const tempWallsShift = currentWallsShift.map((w,idx) => idx === randWallIdx ? {...w, active: !w.active} : w);
                                    if(isPathPossible(newMazesShifted[mazeOwnerShift].start, newMazesShifted[mazeOwnerShift].goal, tempWallsShift, newMazesShifted[mazeOwnerShift].gridSize)) {
                                        currentWallsShift = tempWallsShift;
                                        wallChangeCount++;
                                    }
                                }
                                newMazesShifted[mazeOwnerShift].allWallsConfiguration = currentWallsShift;
                                newMazesShifted[mazeOwnerShift].walls = currentWallsShift.filter(w => w.active);
                            }
                        });
                        updates.mazes = newMazesShifted;
                    }
                } else { updates.specialEventActive = null; }
                nextPhaseTimer = Timestamp.fromMillis(Date.now() + DECLARATION_PHASE_DURATION * 1000); sendSystemChatMessage(`ラウンド ${currentRound} 開始。行動宣言フェーズへ。`);
            }
            updates.currentExtraModePhase = nextPhase;
            if (nextPhaseTimer) updates.phaseTimerEnd = nextPhaseTimer; else updates.phaseTimerEnd = null;
            if (nextActionPlayerId) updates.currentActionPlayerId = nextActionPlayerId; else if (nextPhase !== 'actionExecution') updates.currentActionPlayerId = null;
            if (Object.keys(updates).length > 0) await updateDoc(gameDocRef, updates);
        } catch (error) { console.error("Error advancing extra mode phase:", error); sendSystemChatMessage("フェーズ進行エラー: " + error.message); }
    }, [appId, sendSystemChatMessage]);


    useEffect(() => { /* Phase Timer & Auto-advance ... (same as previous) ... */ 
        if (gameType === 'extra' && gameData?.phaseTimerEnd && gameData?.status === 'playing') {
            const now = Date.now(); const endTime = gameData.phaseTimerEnd.toMillis(); let timeLeft = Math.max(0, Math.floor((endTime - now) / 1000)); setPhaseTimeLeft(timeLeft);
            const timerId = setInterval(() => { timeLeft = Math.max(0, Math.floor((gameData.phaseTimerEnd.toMillis() - Date.now()) / 1000)); setPhaseTimeLeft(timeLeft);
                if (timeLeft <= 0) { clearInterval(timerId); if (userId === gameData.players[0] || userId === gameData.hostId) { console.log(`${gameData.currentExtraModePhase} phase time up. Advancing...`); advanceExtraModePhase(gameId, gameData); } }
            }, 1000); return () => clearInterval(timerId);
        } else { setPhaseTimeLeft(null); }
    }, [gameData, gameType, gameId, userId, advanceExtraModePhase]);

    // Overall Game Timer for Extra Mode
    useEffect(() => {
        if (gameType === 'extra' && gameData?.gameTimerEnd && gameData?.status === 'playing') {
            const now = Date.now();
            const endTime = gameData.gameTimerEnd.toMillis();
            let timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
            setOverallTimeLeft(timeLeft);

            const timerId = setInterval(() => {
                timeLeft = Math.max(0, Math.floor((gameData.gameTimerEnd.toMillis() - Date.now()) / 1000));
                setOverallTimeLeft(timeLeft);
                if (timeLeft <= 0 && gameData.status === 'playing') { // Check status again
                    clearInterval(timerId);
                    if (userId === gameData.players[0] || userId === gameData.hostId) { // Host triggers game end
                        sendSystemChatMessage("全体制限時間に達しました！ゲーム終了処理を開始します。");
                        finalizeGameExtraMode(gameId, gameData);
                    }
                }
            }, 1000);
            return () => clearInterval(timerId);
        } else {
            setOverallTimeLeft(null);
        }
    }, [gameData, gameType, gameId, userId, finalizeGameExtraMode, sendSystemChatMessage]);

    // Personal Thinking Timer for Extra Mode
    useEffect(() => {
        if (gameType === 'extra' && gameData?.status === 'playing' && myPlayerState &&
            (gameData.currentExtraModePhase === 'declaration' && !myPlayerState.hasDeclaredThisTurn) ||
            (gameData.currentExtraModePhase === 'actionExecution' && gameData.currentActionPlayerId === userId && !myPlayerState.actionExecutedThisTurn)
        ) {
            personalTimerIntervalRef.current = setInterval(async () => {
                const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameId);
                try {
                    await updateDoc(gameDocRef, { [`playerStates.${userId}.personalTimeUsed`]: increment(1) });
                } catch (error) { console.error("Error updating personal time:", error); }
            }, 1000);
        } else {
            clearInterval(personalTimerIntervalRef.current);
        }
        return () => clearInterval(personalTimerIntervalRef.current);
    }, [gameData, myPlayerState, userId, gameId, gameType, appId]);


    // Effect to update shared information from allies
    useEffect(() => { /* ... (same as previous) ... */ 
        if (gameType === 'extra' && gameData && myPlayerState && myPlayerState.allianceId) {
            const currentAlliance = gameData.alliances?.find(a => a.id === myPlayerState.allianceId); const allianceTypeDetails = NEGOTIATION_TYPES.find(nt => nt.id === currentAlliance?.type);
            if (currentAlliance && allianceTypeDetails && (allianceTypeDetails.sharesWalls || allianceTypeDetails.sharesScout)) {
                let newSharedWalls = []; let newSharedScouts = [];
                currentAlliance.members.forEach(memberId => { if (memberId !== userId && gameData.playerStates[memberId]) { const memberState = gameData.playerStates[memberId]; if (allianceTypeDetails.sharesWalls) newSharedWalls = newSharedWalls.concat(memberState.revealedWalls || []); if (allianceTypeDetails.sharesScout) newSharedScouts = newSharedScouts.concat(memberState.privateLog?.filter(log => log.text.includes("偵察")) || []); } });
                const uniqueWallStrings = new Set(newSharedWalls.map(w => `${w.r}-${w.c}-${w.type}`)); setSharedWalls(Array.from(uniqueWallStrings).map(s => { const p = s.split('-'); return {r: parseInt(p[0]), c: parseInt(p[1]), type: p[2], active:true}; }));
                setSharedScoutLogs(newSharedScouts.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis()).slice(0,5)); 
            } else { setSharedWalls([]); setSharedScoutLogs([]); }
        } else { setSharedWalls([]); setSharedScoutLogs([]); }
    }, [gameData, myPlayerState, gameType, userId]);


    useEffect(() => { /* Game Data and Chat Listener (main part) */ 
        if (!gameId || !userId) return;
        const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameId);
        const unsubscribeGame = onSnapshot(gameDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data(); setGameData(data); setGameType(data.gameType || 'standard'); const currentPlayerState = data.playerStates?.[userId]; setMyPlayerState(currentPlayerState);
                if (currentPlayerState && data.mazes && data.mazes[currentPlayerState.assignedMazeOwnerId]) setMazeToPlayData(data.mazes[currentPlayerState.assignedMazeOwnerId]);
                if (data.mazes && data.mazes[userId]) { setMyCreatedMazeData(data.mazes[userId]); const solver = Object.entries(data.playerStates || {}).find(([pid, ps]) => ps.assignedMazeOwnerId === userId); if(solver) setPlayerSolvingMyMaze({id: solver[0], ...solver[1]}); else setPlayerSolvingMyMaze(null); }
                if (data.gameType === 'standard' && data.activeBattle && (data.activeBattle.player1Id === userId || data.activeBattle.player2Id === userId) && currentPlayerState && currentPlayerState.battleBet === null && data.activeBattle.status === 'betting') { setIsBattleModalOpen(true); setBattleOpponentId(data.activeBattle.player1Id === userId ? data.activeBattle.player2Id : data.activeBattle.player1Id); } else { setIsBattleModalOpen(false); }
                if (data.status === "finished") { 
                    if(!isGameOverModalOpen) setIsGameOverModalOpen(true); // Open modal if not already
                    let endMessage = "ゲーム終了！ "; const sortedPlayers = (data.players || []).map(pid => ({ id: pid, ...data.playerStates[pid] })).sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity) || (b.score || 0) - (a.score || 0) ); endMessage += sortedPlayers.map((p, idx) => `${p.rank || idx + 1}位: ${p.id.substring(0,8)} (${p.score || 0}pt)`).join('; '); setMessage(endMessage); return; 
                }
                if (data.status !== "playing") return;
                let currentPhaseMessage = "";
                if (data.gameType === 'extra') { /* ... phase message logic ... */ 
                    currentPhaseMessage = `エクストラ ラウンド ${data.roundNumber || 1} - `;
                    switch(data.currentExtraModePhase) {
                        case "declaration": currentPhaseMessage += "行動宣言フェーズ"; if (currentPlayerState && !currentPlayerState.hasDeclaredThisTurn) currentPhaseMessage += " あなたの行動を宣言してください。"; else currentPhaseMessage += " 他のプレイヤーの宣言待ち..."; break;
                        case "priorityResolution": currentPhaseMessage += "優先度決定中..."; break;
                        case "actionExecution": currentPhaseMessage += `行動実行中 (${data.currentActionPlayerId ? data.currentActionPlayerId.substring(0,5) : '-'})`; break;
                        case "resultPublication": currentPhaseMessage += "結果発表中..."; break;
                        case "chat": currentPhaseMessage += "チャットフェーズ"; break;
                        default: currentPhaseMessage += "準備中";
                    }
                } else { /* Standard mode message logic */  if (data.currentTurnPlayerId === userId) { if(currentPlayerState?.isTurnSkipped) currentPhaseMessage="あなたは1ターン休みです。"; else if (data.activeBattle) currentPhaseMessage=`${battleOpponentId ? battleOpponentId.substring(0,8) : '相手'}とバトル中！ポイント入力待機。`; else currentPhaseMessage="あなたのターンです。移動してください。"; } else { currentPhaseMessage=`相手 (${data.currentTurnPlayerId ? data.currentTurnPlayerId.substring(0,8) : '?'}) のターンです...`; } }
                setMessage(currentPhaseMessage);
                if (data.gameType === 'extra' && data.currentExtraModePhase === 'actionExecution' && data.currentActionPlayerId === userId && myPlayerState?.declaredAction && !myPlayerState.actionExecutedThisTurn) { // Added actionExecutedThisTurn check
                    executeMyDeclaredAction();
                }
            } else { setMessage("ゲームデータが見つかりません。"); setScreen('lobby'); }
        });
        const chatCollRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames/${gameId}/chatMessages`);
        const qChat = query(chatCollRef, orderBy("timestamp", "desc"), limit(50)); 
        const unsubscribeChat = onSnapshot(qChat, (querySnapshot) => { const messages = []; querySnapshot.forEach((doc) => messages.push({ id: doc.id, ...doc.data() })); setChatMessages(messages.reverse()); });
        // Action Log Listener
        if (gameType === 'extra' && gameId) {
            const actionLogRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames/${gameId}/actionLog`); // Assuming subcollection
            const qActionLog = query(actionLogRef, orderBy("timestamp", "desc"), limit(10));
            const unsubscribeActionLog = onSnapshot(qActionLog, (snapshot) => {
                const logs = [];
                snapshot.forEach(doc => logs.push({id: doc.id, ...doc.data()}));
                setActionLog(logs.reverse());
            });
            return () => { unsubscribeGame(); unsubscribeChat(); unsubscribeActionLog(); };
        }

        return () => { unsubscribeGame(); unsubscribeChat(); };
    }, [gameId, userId, setScreen, advanceExtraModePhase, executeMyDeclaredAction, isGameOverModalOpen, gameType]); // Added gameType

    const handleDeclareAction = async () => { /* ... (same as previous, calls advanceExtraModePhase) ... */ 
        if (!gameData || gameType !== 'extra' || gameData.currentExtraModePhase !== 'declaration' || !myPlayerState || myPlayerState.hasDeclaredThisTurn || !selectedAction) { setMessage("宣言できません。"); return; }
        const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameId);
        const declarationData = { type: selectedAction, targetId: actionTarget, details: {}, submittedAt: serverTimestamp() };
        if (selectedAction === 'sabotage') { if (!sabotageType) { setMessage("妨害タイプを選択してください。"); return; } declarationData.details.sabotageType = sabotageType; if (sabotageType === 'trap') { if (!trapPlacementCoord) { setMessage("トラップの設置座標を選択してください。"); return; } declarationData.details.trapCoordinates = trapPlacementCoord; } }
        if (selectedAction === 'negotiate') { if (!negotiationDetails.type) { setMessage("交渉タイプを選択してください。"); return; } declarationData.details.negotiation = negotiationDetails; }
        try {
            await updateDoc(gameDocRef, { [`declarations.${userId}`]: declarationData, [`playerStates.${userId}.hasDeclaredThisTurn`]: true, [`playerStates.${userId}.actionExecutedThisTurn`]: false }); // Reset actionExecutedThisTurn
            setMessage(`${selectedAction} を宣言しました。他のプレイヤーを待っています...`);
            setSelectedAction(null); setActionTarget(null); setShowActionDetails(false); setSabotageType(null); setNegotiationDetails({type: null, duration: null, conditions: ""}); setIsPlacingTrap(false); setTrapPlacementCoord(null);
            const updatedGameSnap = await getDoc(gameDocRef);
            if (updatedGameSnap.exists()) { const updatedGData = updatedGameSnap.data(); const allDeclared = updatedGData.players.every(pid => updatedGData.declarations[pid]?.type); if (allDeclared) advanceExtraModePhase(gameId, updatedGData); }
        } catch (error) { console.error("Error declaring action:", error); setMessage("宣言エラー: " + error.message); }
    };
    
    const executeMyDeclaredAction = useCallback(async () => { /* ... (same as previous, with sabotage/negotiation placeholders) ... */ 
        if (!gameData || !myPlayerState || !myPlayerState.declaredAction || myPlayerState.declaredAction.type === null || myPlayerState.actionExecutedThisTurn) return; 
        const action = myPlayerState.declaredAction; let actionResultSummary = `${userId.substring(0,5)} が ${action.type} を実行。`; const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameId); let updates = {};
        updates[`playerStates.${userId}.actionExecutedThisTurn`] = true; 
        sendSystemChatMessage(`${userId.substring(0,5)} のアクション: ${action.type} ${action.targetId ? `(対象: ${action.targetId.substring(0,5)})` : ''} ${action.details?.sabotageType ? `(タイプ: ${action.details.sabotageType})` : ''}`);
        switch(action.type) {
            case 'move': /* ... (move logic from previous, including trap check) ... */ 
                const { r: currentR, c: currentC } = myPlayerState.position; let newR = currentR, newC = currentC;
                // For Extra Mode, move needs a target cell selected during declaration, stored in action.details.targetCell
                if (action.details?.targetCell) { newR = action.details.targetCell.r; newC = action.details.targetCell.c;} 
                else { actionResultSummary += ` 移動先未指定のため待機扱い。`; updates[`playerStates.${userId}.declaredAction`] = {type: 'wait'}; /* effectively a wait */ break; } // If no target, treat as wait

                const confusionEffect = myPlayerState.sabotageEffects?.find(eff => eff.type === 'confusion' && eff.expiryRound >= gameData.roundNumber);
                if (confusionEffect) { actionResultSummary += `混乱状態で移動方向がランダムに！ `; const directions = [[0,1], [0,-1], [1,0], [-1,0]]; const randDir = directions[Math.floor(Math.random() * directions.length)]; newR = currentR + randDir[0]; newC = currentC + randDir[1]; updates[`playerStates.${userId}.sabotageEffects`] = arrayRemove(confusionEffect); }
                if (newR < 0 || newR >= currentGridSize || newC < 0 || newC >= currentGridSize) { actionResultSummary += `盤外へ移動しようとして失敗。`; }
                else { const landingOnTrap = gameData.traps?.find(t => t.r === newR && t.c === newC && t.ownerId !== userId && t.expiryRound >= gameData.roundNumber && t.mazeOwnerId === myPlayerState.assignedMazeOwnerId);
                    if (landingOnTrap) { actionResultSummary += ` (${newR},${newC})へ移動しようとしたが、${landingOnTrap.ownerId.substring(0,5)}のトラップに嵌った！1ターン休み。`; updates[`playerStates.${userId}.isTurnSkipped`] = true; sendSystemChatMessage(`${userId.substring(0,5)}が${landingOnTrap.ownerId.substring(0,5)}のトラップに嵌った！`); updates[`playerStates.${landingOnTrap.ownerId}.score`] = increment(5); }
                    else { updates[`playerStates.${userId}.position`] = {r: newR, c: newC}; actionResultSummary += ` (${newR},${newC})へ移動。`; if (!myPlayerState.revealedCells[`${newR}-${newC}`]) { updates[`playerStates.${userId}.score`] = increment(1); updates[`playerStates.${userId}.revealedCells.${newR}-${newC}`] = true; actionResultSummary += ` +1pt。`; } } }
                // Goal Check for COMP_FIRST_GOAL
                if (mazeToPlayData && newR === mazeToPlayData.goal.r && newC === mazeToPlayData.goal.c && !myPlayerState.goalTime) {
                    updates[`playerStates.${userId}.goalTime`] = serverTimestamp(); // Mark goal time
                    updates.goalCount = increment(1);
                    updates.playerGoalOrder = arrayUnion({playerId: userId, time: serverTimestamp()}); // Use serverTimestamp for order
                    actionResultSummary += ` ゴール！`;

                    if (myPlayerState.secretObjective?.id === "COMP_FIRST_GOAL" && !myPlayerState.secretObjective.achieved && !myPlayerState.allianceId && gameData.goalCount === 0) { // goalCount is before this player's goal
                        updates[`playerStates.${userId}.secretObjective.achieved`] = true;
                        updates[`playerStates.${userId}.score`] = increment(myPlayerState.secretObjective.points);
                        actionResultSummary += ` [秘密目標達成: ${myPlayerState.secretObjective.text}]`;
                        sendSystemChatMessage(`${userId.substring(0,5)}が秘密目標「${myPlayerState.secretObjective.text}」を達成！ (+${myPlayerState.secretObjective.points}pt)`);
                    }
                     // Check if game should end (e.g., all players goaled or time up)
                    if ( (gameData.goalCount + 1) >= gameData.players.length && gameData.status !== 'finished') {
                        finalizeGameExtraMode(gameId, {...gameData, playerStates: {...gameData.playerStates, [userId]: {...myPlayerState, goalTime: Timestamp.now() /* temp for finalize */}}, goalCount: gameData.goalCount + 1}); // Pass potentially updated data
                    }
                }
                break;
            case 'scout': /* ... (same as previous) ... */ 
                if (action.targetId && gameData.playerStates[action.targetId]) { const targetPos = gameData.playerStates[action.targetId].position; actionResultSummary += ` 対象 (${action.targetId.substring(0,5)}) の位置は (${targetPos.r}, ${targetPos.c})。`; updates[`playerStates.${userId}.privateLog`] = arrayUnion({round: gameData.roundNumber, text: actionResultSummary, timestamp: serverTimestamp()}); updates[`playerStates.${userId}.score`] = increment(3); if (Math.random() < 0.3) sendSystemChatMessage(`${action.targetId.substring(0,5)} は偵察されたようです！`); } else { actionResultSummary += ` 対象不明。`; }
                break;
            case 'sabotage': /* ... (same as previous, with score increment) ... */ 
                const sabType = action.details?.sabotageType; const targetId = action.targetId; actionResultSummary += ` ${sabType || '不明な'}妨害を ${targetId ? targetId.substring(0,5) : '誰か'} に試行。`;
                if (targetId && gameData.playerStates[targetId]) {
                    const currentAlliance = gameData.alliances?.find(a => a.id === myPlayerState.allianceId);
                    if (currentAlliance && currentAlliance.members.includes(targetId) && currentAlliance.type === 'non_aggression') { 
                        actionResultSummary += ` しかし、相互不可侵条約により妨害できず！ペナルティ -15pt。`; 
                        updates[`playerStates.${userId}.score`] = increment(ALLIANCE_VIOLATION_PENALTY);
                    } else {
                        let sabotageSuccess = false;
                        if (sabType === 'trap' && action.details?.trapCoordinates) { const {r: trapR, c: trapC} = action.details.trapCoordinates; updates.traps = arrayUnion({r: trapR, c: trapC, ownerId: userId, mazeOwnerId: gameData.playerStates[targetId].assignedMazeOwnerId, expiryRound: gameData.roundNumber + 1}); actionResultSummary += ` (${trapR},${trapC})にトラップ設置！`; sabotageSuccess = true; }
                        else if (sabType === 'confusion') { if (Math.random() < 0.7) { updates[`playerStates.${targetId}.sabotageEffects`] = arrayUnion({type: 'confusion', expiryRound: gameData.roundNumber + 1}); actionResultSummary += ` ${targetId.substring(0,5)}に混乱攻撃成功！`; sabotageSuccess = true; } else { updates[`playerStates.${userId}.sabotageEffects`] = arrayUnion({type: 'confusion', expiryRound: gameData.roundNumber + 1}); actionResultSummary += ` 混乱攻撃失敗！自身が混乱状態に。`; } }
                        else if (sabType === 'info_jam') { updates[`playerStates.${targetId}.sabotageEffects`] = arrayUnion({type: 'info_jam', expiryRound: gameData.roundNumber + 1}); actionResultSummary += ` ${targetId.substring(0,5)}の情報妨害成功！`; sabotageSuccess = true; }
                        if (sabotageSuccess) {
                            updates[`playerStates.${userId}.score`] = increment(5);
                            if (myPlayerState.secretObjective?.id === "SAB_OBSTRUCT_THRICE" && !myPlayerState.secretObjective.achieved) {
                                const newProgress = (myPlayerState.secretObjective.progress || 0) + 1;
                                updates[`playerStates.${userId}.secretObjective.progress`] = newProgress;
                                if (newProgress >= myPlayerState.secretObjective.counterMax) {
                                    updates[`playerStates.${userId}.secretObjective.achieved`] = true;
                                    updates[`playerStates.${userId}.score`] = increment(myPlayerState.secretObjective.points);
                                    actionResultSummary += ` [秘密目標達成: ${myPlayerState.secretObjective.text}]`;
                                    sendSystemChatMessage(`${userId.substring(0,5)}が秘密目標「${myPlayerState.secretObjective.text}」を達成！ (+${myPlayerState.secretObjective.points}pt)`);
                                }
                            }
                        }
                    }
                } else { actionResultSummary += ` 対象不在かタイプ不明で失敗。`; }
                break;
            case 'negotiate': 
                actionResultSummary += ` 交渉行動。`;
                if (action.details?.negotiation?.type === 'betrayal') {
                    if (myPlayerState.allianceId) {
                        const oldAllianceId = myPlayerState.allianceId;
                        const oldAlliance = gameData.alliances.find(a => a.id === oldAllianceId);
                        if (oldAlliance) {
                            // Mark alliance as betrayed instead of removing, or store betrayed status
                            const updatedAlliances = gameData.alliances.map(a => a.id === oldAllianceId ? {...a, status: 'betrayed', betrayedBy: userId, betrayedRound: gameData.roundNumber } : a);
                            updates.alliances = updatedAlliances; 
                            
                            oldAlliance.members.forEach(memberId => {
                                if (memberId !== userId) { 
                                    sendSystemChatMessage(`${memberId.substring(0,5)}！ ${userId.substring(0,5)}があなたとの同盟を裏切りました！`);
                                    updates[`playerStates.${memberId}.privateLog`] = arrayUnion({round: gameData.roundNumber, text: `${userId.substring(0,5)}に裏切られました。同盟ID: ${oldAllianceId.substring(0,5)}`, timestamp: serverTimestamp()});
                                }
                                updates[`playerStates.${memberId}.allianceId`] = null; // All members lose alliance
                            });
                            actionResultSummary += ` ${oldAlliance.members.filter(m=>m!==userId).map(m=>m.substring(0,5)).join(',')}との同盟を裏切り宣言！`;
                            // updates[`playerStates.${userId}.score`] = increment(5); // Betrayal success points are game-end
                            updates[`playerStates.${userId}.temporaryPriorityBoost`] = (myPlayerState.temporaryPriorityBoost || 0) + 1; 
                            updates[`playerStates.${userId}.betrayedAllies`] = arrayUnion(...oldAlliance.members.filter(m => m !== userId));
                        } else { actionResultSummary += ` 存在しない同盟を裏切ろうとしました。`; }
                    } else { actionResultSummary += ` 裏切る同盟がありません。`; }
                } else if (action.targetId && action.details?.negotiation) { 
                    const offerId = doc(collection(db, 'dummy')).id; 
                    updates[`playerStates.${action.targetId}.negotiationOffers`] = arrayUnion({ fromPlayerId: userId, offerId: offerId, type: action.details.negotiation.type, duration: NEGOTIATION_TYPES.find(nt => nt.id === action.details.negotiation.type)?.duration, conditions: action.details.negotiation.conditions, status: 'pending', timestamp: serverTimestamp() }); 
                    actionResultSummary += ` ${action.targetId.substring(0,5)}に「${NEGOTIATION_TYPES.find(nt => nt.id === action.details.negotiation.type)?.label}」を提案。`; 
                } else { actionResultSummary += ` 交渉対象または詳細不明。`;}
                break;
            case 'wait': actionResultSummary += ` 待機しました。`; break;
            default: actionResultSummary += ` 未知のアクションタイプ。`;
        }
        updates.actionLog = arrayUnion({round: gameData.roundNumber, playerId: userId, actionType: action.type, targetId: action.targetId, resultSummary, timestamp: serverTimestamp()});
        try { await updateDoc(gameDocRef, updates); setTimeout(async () => { if (userId === gameData.currentActionPlayerId) { const latestGameData = (await getDoc(gameDocRef)).data(); await advanceExtraModePhase(gameId, latestGameData); } }, ACTION_EXECUTION_DELAY); }
        catch (error) { console.error("Error executing action:", error); sendSystemChatMessage(`アクション実行エラー (${userId.substring(0,5)}): ${error.message}`); }
    }, [gameData, myPlayerState, userId, gameId, sendSystemChatMessage, advanceExtraModePhase, currentGridSize, mazeToPlayData, finalizeGameExtraMode]); // Added finalizeGameExtraMode

    const handleNegotiationResponse = async (offerId, response) => { /* ... (same as previous) ... */ 
        if (!gameData || !myPlayerState || !offerId) return; const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, gameId);
        try {
            await runTransaction(db, async (transaction) => {
                const currentDoc = await transaction.get(gameDocRef); if (!currentDoc.exists()) throw "Game not found!"; const currentGData = currentDoc.data(); const currentPState = currentGData.playerStates[userId];
                const offerIndex = currentPState.negotiationOffers.findIndex(o => o.offerId === offerId && o.status === 'pending'); if (offerIndex === -1) throw "Offer not found or already handled.";
                const offer = currentPState.negotiationOffers[offerIndex]; const newOffers = [...currentPState.negotiationOffers]; newOffers[offerIndex] = { ...offer, status: response };
                let transactionUpdates = { [`playerStates.${userId}.negotiationOffers`]: newOffers }; let systemMsgText = `${userId.substring(0,5)}が${offer.fromPlayerId.substring(0,5)}からの「${NEGOTIATION_TYPES.find(nt=>nt.id === offer.type)?.label}」提案を${response === 'accepted' ? '受諾' : '拒否'}しました。`;
                if (response === 'accepted') {
                    if (currentPState.allianceId || currentGData.playerStates[offer.fromPlayerId].allianceId) { systemMsgText += " しかし、どちらかが既に別の同盟に所属しているため、新しい同盟は結成できませんでした。"; }
                    else {
                        const allianceId = doc(collection(db, 'dummy')).id;
                        const newAlliance = { id: allianceId, members: [offer.fromPlayerId, userId], type: offer.type, durationTurns: offer.duration, startRound: currentGData.roundNumber, trustLevel: 100, conditions: offer.conditions, createdAt: serverTimestamp() };
                        transactionUpdates.alliances = arrayUnion(newAlliance);
                        transactionUpdates[`playerStates.${userId}.allianceId`] = allianceId;
                        transactionUpdates[`playerStates.${offer.fromPlayerId}.allianceId`] = allianceId;
                        systemMsgText += " 新しい同盟が結成されました！";
                        
                        // Check COOP_LARGE_ALLIANCE for all members
                        if (newAlliance.members.length >= 3) { // This condition won't be met for 2-player alliances
                            newAlliance.members.forEach(memberId => {
                                const memberState = currentGData.playerStates[memberId];
                                if (memberState.secretObjective?.id === "COOP_LARGE_ALLIANCE" && !memberState.secretObjective.achieved) {
                                    transactionUpdates[`playerStates.${memberId}.secretObjective.achieved`] = true;
                                    transactionUpdates[`playerStates.${memberId}.score`] = increment(memberState.secretObjective.points);
                                    // Use a separate call for system message if needed, or ensure it's safe within transaction context
                                    // sendSystemChatMessage(`${memberId.substring(0,5)}が秘密目標「3人以上の同盟を成立させる」を達成！ (+${memberState.secretObjective.points}pt)`);
                                    // For safety, system messages are often sent outside transactions or via cloud functions.
                                    // Here, we'll just update the state. A global system message can be triggered by observing this change.
                                    const chatCollRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames/${gameId}/chatMessages`);
                                    transaction.set(doc(chatCollRef), { senderId: "system", senderName: "システム", text: `${memberId.substring(0,5)}が秘密目標「3人以上の同盟を成立させる」を達成！ (+${memberState.secretObjective.points}pt)`, timestamp: serverTimestamp() });
                                }
                            });
                        }
                    }
                }
                transaction.update(gameDocRef, transactionUpdates);
                // Send system message outside transaction if it causes issues, or ensure it's safe.
                // sendSystemChatMessage(systemMsgText); // Moved to be potentially outside or handled by observing state changes.
                 const chatCollRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames/${gameId}/chatMessages`);
                 transaction.set(doc(chatCollRef), { senderId: "system", senderName: "システム", text: systemMsgText, timestamp: serverTimestamp() });
            });
        } catch (error) { console.error("Error responding to negotiation:", error); sendSystemChatMessage("交渉応答エラー: " + error.message); }
    };


    // Standard mode placeholders (will not be called if gameType is 'extra')
    const handleStandardMove = async (direction) => { console.log("Standard Move:", direction); };
    const handleStandardBattleBet = async (betAmount) => { console.log("Standard Bet:", betAmount); };
    const resolveStandardBattle = useCallback(async (gameIdToResolve, p1IdCurrent, p2IdCurrent) => { console.log("Resolve Standard Battle");}, []);
    const handleSendChatMessage = async (systemMessage = null) => { /* ... (same as previous) ... */ 
        const textToSend = systemMessage ? systemMessage.text : chatInput.trim();
        const sender = systemMessage ? systemMessage.senderId : userId;
        const senderName = systemMessage ? systemMessage.senderName : userId.substring(0,8);
        if (textToSend === "" || !gameId ) return;
        const chatCollRef = collection(db, `artifacts/${appId}/public/data/labyrinthGames/${gameId}/chatMessages`);
        try { 
            if (!systemMessage && myPlayerState?.sabotageEffects?.find(eff => eff.type === 'info_jam' && eff.expiryRound >= gameData?.roundNumber) && gameData?.specialEventActive?.type !== 'communication_jam') {
                sendSystemChatMessage(`${userId.substring(0,5)}は情報妨害を受けておりチャットできません！`);
                setChatInput(""); return;
            }
            if (!systemMessage && gameData?.specialEventActive?.type === 'communication_jam' && gameData.specialEventActive.visibleUntilRound >= gameData.roundNumber) {
                sendSystemChatMessage(`特殊イベント「通信妨害」発動中！チャットは使用できません。`);
                 setChatInput(""); return;
            }
            await addDoc(chatCollRef, { senderId: sender, senderName: senderName, text: textToSend, timestamp: serverTimestamp() }); 
            if (!systemMessage) setChatInput(""); 
        }
        catch (error) { console.error("Error sending chat message:", error); }
    };

    const formatPhaseTime = (seconds) => { /* ... (same as previous) ... */ if (seconds === null || seconds < 0) return "--:--"; const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`; };
    
    const ActionButton = ({ actionType, label, icon: IconComp, currentSelection, onSelect }) => ( /* ... (same as previous) ... */ 
        <button onClick={() => { setSelectedAction(actionType); setActionTarget(null); setSabotageType(null); setNegotiationDetails({type:null, duration:null, conditions:""}); setShowActionDetails(true); setIsPlacingTrap(actionType === 'sabotage'); }}
            className={`w-full p-2 text-white rounded flex items-center justify-center space-x-2 transition-all ${currentSelection === actionType ? 'ring-2 ring-offset-2 ring-yellow-400 shadow-lg' : 'hover:opacity-90'} ${actionType === 'move' ? 'bg-cyan-500' : ''} ${actionType === 'scout' ? 'bg-lime-500' : ''} ${actionType === 'sabotage' ? 'bg-amber-500' : ''} ${actionType === 'negotiate' ? 'bg-pink-500' : ''} ${actionType === 'wait' ? 'bg-gray-400' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={gameData?.currentExtraModePhase !== 'declaration' || myPlayerState?.hasDeclaredThisTurn} >
            <IconComp size={18}/> <span>{label}</span>
        </button>
    );
    
    const handleTrapCoordinateSelect = (r, c) => {
        setTrapPlacementCoord({r,c});
        setIsPlacingTrap(false); 
        setMessage(`トラップ設置座標: (${r},${c}) を選択しました。`);
    };


    const isMyStandardTurn = gameType === 'standard' && gameData?.currentTurnPlayerId === userId && !myPlayerState?.isTurnSkipped && gameData?.status === 'playing' && !gameData?.activeBattle;
    const inStandardBattleBetting = gameType === 'standard' && gameData?.activeBattle && (gameData.activeBattle.player1Id === userId || gameData.activeBattle.player2Id === userId) && myPlayerState?.battleBet === null;


    if (!gameData || !myPlayerState ) { 
        return <div className="flex items-center justify-center min-h-screen bg-slate-100"><p className="text-xl p-4 text-center">ゲームデータを読み込んでいます...<br/>リロードしても表示されない場合は、ロビーに戻って再試行してください。</p></div>;
    }

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-slate-100 p-2 md:p-4 pt-4 md:pt-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-1 text-slate-800">プレイ中！ ({gameType === 'extra' ? 'エクストラモード' : gameMode})</h1>
            <div className="flex space-x-4 text-xs md:text-sm text-slate-600 mb-1">
                <span>ゲームID: {gameId?.substring(0,8)}...</span>
                {gameType === 'extra' && overallTimeLeft !== null && <span><TimerIcon size={16} className="inline mr-1"/> 全体残り: {formatPhaseTime(overallTimeLeft)}</span>}
            </div>
            {gameType === 'extra' && phaseTimeLeft !== null && <p className="text-md font-semibold text-blue-600 mb-1"> <Clock size={18} className="inline mr-1"/> フェーズ残り時間: {formatPhaseTime(phaseTimeLeft)} </p> }
            {gameData?.specialEventActive && gameData.specialEventActive.visibleUntilRound >= gameData.roundNumber && (
                <div className="my-2 p-2 bg-yellow-400 text-yellow-800 rounded-md shadow-lg text-sm font-semibold w-full max-w-xl text-center">
                    <Megaphone size={16} className="inline mr-1" /> 特殊イベント: 「{gameData.specialEventActive.name}」発動中！ {gameData.specialEventActive.description}
                </div>
            )}
            <p className={`text-sm md:text-md font-semibold mb-2 p-2 rounded w-full max-w-xl text-center ${isMyStandardTurn && !inStandardBattleBetting && gameType === 'standard' ? 'bg-green-100 text-green-700' : (inStandardBattleBetting && gameType === 'standard' ? 'bg-yellow-100 text-yellow-700' : (gameType === 'standard' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'))}`}>{message}</p>
            {gameType === 'standard' && <BattleModal isOpen={isBattleModalOpen} onClose={() => setIsBattleModalOpen(false)} onBet={handleStandardBattleBet} maxBet={myPlayerState?.score > 0 ? myPlayerState.score : 1} opponentName={battleOpponentId} myName={userId} myCurrentScore={myPlayerState?.score || 0} />}
            <GameOverModal isOpen={isGameOverModalOpen} gameData={gameData} userId={userId} onClose={() => { setIsGameOverModalOpen(false); localStorage.removeItem('labyrinthGameId'); localStorage.removeItem('labyrinthGameType'); setScreen('lobby'); }} />


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full max-w-7xl">
                 <div className="lg:col-span-1 bg-white p-3 rounded-lg shadow-xl space-y-3 order-2 lg:order-1"> {/* Player Info Panel */}
                    <h3 className="text-lg font-semibold border-b pb-1">プレイヤー情報</h3>
                     {gameType === 'extra' && myPlayerState && <p className="text-xs text-gray-500"><TimerIcon size={12} className="inline mr-0.5"/> 個人思考時間: {formatPhaseTime(myPlayerState.personalTimeUsed)} / {formatPhaseTime(EXTRA_MODE_PERSONAL_TIME_LIMIT)}</p>}
                    <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                        {(gameData.turnOrder || gameData.players).map(pid => { const pState = gameData.playerStates[pid]; if (!pState) return null;
                            const currentAlliance = gameData.alliances?.find(a => a.id === pState.allianceId && a.status !== 'betrayed'); // Filter out betrayed alliances
                            const allianceDetails = currentAlliance ? NEGOTIATION_TYPES.find(nt => nt.id === currentAlliance.type) : null;
                            return ( <li key={pid} className={`p-1 rounded ${pid === userId ? 'bg-blue-100 font-bold' : ''} ${pid === gameData.currentTurnPlayerId && gameData.status === 'playing' && gameType === 'standard' ? 'ring-2 ring-green-500' : ''} ${pid === gameData.currentActionPlayerId && gameData.status === 'playing' && gameType === 'extra' && gameData.currentExtraModePhase === 'actionExecution' ? 'ring-2 ring-purple-500' : ''}`}> {pState.rank && <Award size={14} className="inline mr-1 text-yellow-500" title={`ランク: ${pState.rank}位`}/>} {pid.substring(0,8)}... : {pState.score || 0}pt {pState.goalTime && <CheckCircle size={14} className="inline ml-1 text-green-600" title={`ゴール済 (${pState.rank || '?'}位)`}/>} {pState.isTurnSkipped && <XCircle size={14} className="inline ml-1 text-orange-500" title="休み"/>} {pState.inBattleWith && gameType === 'standard' && <Swords size={14} className="inline ml-1 text-red-500" title={`バトル中: ${pState.inBattleWith.substring(0,5)}`}/>} {gameType === 'extra' && pState.hasDeclaredThisTurn && gameData.currentExtraModePhase === 'declaration' && <ListChecks size={14} className="inline ml-1 text-blue-500" title="宣言済"/>} {currentAlliance && allianceDetails && <Handshake size={12} className="inline ml-1 text-teal-600" title={`同盟: ${allianceDetails.label} (R${currentAlliance.startRound}~${currentAlliance.durationTurns === Infinity ? '永続' : 'あと'+ Math.max(0, (currentAlliance.startRound + currentAlliance.durationTurns - (gameData.roundNumber || 1))) + 'R'}) 信頼度: ${currentAlliance.trustLevel}`}/> } </li> )
                        })}
                    </ul>
                    {myPlayerState?.secretObjective && gameType === 'extra' && ( <div className="mt-3 pt-2 border-t"> <h4 className="text-md font-semibold mb-1 text-purple-700"><Target size={16} className="inline mr-1"/> あなたの秘密目標:</h4> <p className="text-xs bg-purple-50 p-2 rounded">{myPlayerState.secretObjective.text} {myPlayerState.secretObjective.achieved ? <CheckCircle className="inline text-green-500 ml-1" title="達成済"/> : (myPlayerState.secretObjective.progress > 0 && myPlayerState.secretObjective.counterMax ? <span className="text-blue-500 ml-1">({myPlayerState.secretObjective.progress}/{myPlayerState.secretObjective.counterMax})</span> : "")}</p> </div> )}
                    {myCreatedMazeData && ( <div className="mt-3 pt-2 border-t"> <h4 className="text-md font-semibold mb-1">あなたの作成した迷路 {playerSolvingMyMaze ? ` (挑戦者: ${playerSolvingMyMaze.id.substring(0,8)}...)` : ""} </h4> <div className="flex justify-center"> <MazeGrid mazeData={myCreatedMazeData} playerPosition={playerSolvingMyMaze?.position} smallView={true} showAllWalls={true} highlightPlayer={!!playerSolvingMyMaze} gridSize={myCreatedMazeData.gridSize || STANDARD_GRID_SIZE} traps={gameData?.traps?.filter(t => t.mazeOwnerId === userId)} alliedPlayersPos={gameData && myPlayerState?.allianceId ? gameData.players.filter(pid => pid !== userId && gameData.playerStates[pid]?.allianceId === myPlayerState.allianceId).map(pid => ({...gameData.playerStates[pid].position, id:pid})) : []} /> </div> </div> )}
                     {gameType === 'extra' && myPlayerState?.privateLog && myPlayerState.privateLog.length > 0 && ( <div className="mt-3 pt-2 border-t"> <h4 className="text-md font-semibold mb-1 text-indigo-700"><Eye size={16} className="inline mr-1"/> 個人ログ:</h4> <ul className="text-xs bg-indigo-50 p-2 rounded max-h-24 overflow-y-auto"> {myPlayerState.privateLog.slice(-5).map((log, idx) => <li key={idx}>R{log.round}: {log.text}</li>)} </ul> </div> )}
                     {gameType === 'extra' && sharedScoutLogs.length > 0 && ( <div className="mt-3 pt-2 border-t"> <h4 className="text-md font-semibold mb-1 text-teal-700"><Users2 size={16} className="inline mr-1"/> 同盟共有偵察ログ:</h4> <ul className="text-xs bg-teal-50 p-2 rounded max-h-24 overflow-y-auto"> {sharedScoutLogs.map((log, idx) => <li key={idx}>R{log.round} ({log.senderName}): {log.text}</li>)} </ul> </div> )}
                     {gameType === 'extra' && myPlayerState?.negotiationOffers && myPlayerState.negotiationOffers.filter(o => o.status === 'pending').length > 0 && (
                        <div className="mt-3 pt-2 border-t"> <h4 className="text-md font-semibold mb-1 text-pink-700"><Handshake size={16} className="inline mr-1"/> 交渉提案あり ({myPlayerState.negotiationOffers.filter(o => o.status === 'pending').length}件):</h4>
                            {myPlayerState.negotiationOffers.filter(o => o.status === 'pending').map(offer => (
                                <div key={offer.offerId} className="text-xs bg-pink-50 p-2 rounded mt-1">
                                    <p><span className="font-semibold">{offer.fromPlayerId.substring(0,5)}</span>から「<span className="font-semibold">{NEGOTIATION_TYPES.find(nt=>nt.id === offer.type)?.label}</span>」の提案。</p>
                                    {offer.conditions && <p className="text-2xs italic mt-0.5">条件: {offer.conditions}</p>}
                                    <div className="mt-1">
                                        <button onClick={() => handleNegotiationResponse(offer.offerId, 'accepted')} className="text-2xs bg-green-500 hover:bg-green-600 text-white px-1.5 py-0.5 rounded mr-1"><ThumbsUp size={12} className="inline"/> 受諾</button>
                                        <button onClick={() => handleNegotiationResponse(offer.offerId, 'rejected')} className="text-2xs bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded"><ThumbsDown size={12} className="inline"/> 拒否</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-xl order-1 lg:order-2 flex flex-col items-center"> {/* Main Maze Panel */}
                    <h2 className="text-xl font-semibold mb-2 text-center">あなたの挑戦 (迷路作成者: {myPlayerState?.assignedMazeOwnerId?.substring(0,8)}...)</h2>
                    {mazeToPlayData ? ( <MazeGrid mazeData={mazeToPlayData} playerPosition={myPlayerState.position} showAllWalls={showOpponentWallsDebug || (gameData?.specialEventActive?.type === 'information_leak' && gameData.specialEventActive.visibleUntilRound >= gameData.roundNumber)} revealedPlayerWalls={myPlayerState.revealedWalls || []} revealedCells={myPlayerState.revealedCells} otherPlayers={Object.entries(gameData.playerStates || {}).filter(([pid]) => pid !== userId && gameData.playerStates[pid]?.assignedMazeOwnerId === myPlayerState.assignedMazeOwnerId).map(([id,ps])=> ({id, ...ps}))} gridSize={mazeToPlayData.gridSize || STANDARD_GRID_SIZE} traps={gameData?.traps?.filter(t => t.mazeOwnerId === myPlayerState.assignedMazeOwnerId)} selectingTrapCoord={isPlacingTrap && selectedAction === 'sabotage' && sabotageType === 'trap'} onTrapCoordSelect={handleTrapCoordinateSelect} alliedPlayersPos={gameData && myPlayerState?.allianceId ? gameData.players.filter(pid => pid !== userId && gameData.playerStates[pid]?.allianceId === myPlayerState.allianceId && gameData.playerStates[pid]?.assignedMazeOwnerId === myPlayerState.assignedMazeOwnerId).map(pid => ({...gameData.playerStates[pid].position, id:pid})) : []} sharedWallsFromAllies={sharedWalls} showAllPlayerPositions={gameData?.specialEventActive?.type === 'information_leak' && gameData.specialEventActive.visibleUntilRound >= gameData.roundNumber} /> ) : <p className="text-center text-gray-500">攻略する迷路を読み込み中...</p>}
                    <div className="mt-3 text-center"> <button onClick={() => setShowOpponentWallsDebug(s => !s)} className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"> {showOpponentWallsDebug ? <EyeOff size={14} className="inline"/> : <Eye size={14} className="inline"/>} 全壁表示 (デバッグ) </button> </div>
                </div>
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-xl order-3 lg:order-3 space-y-3"> {/* Actions & Chat Panel */}
                    {gameType === 'standard' && ( <div> {/* ... Standard mode actions ... */} </div> )}
                    {gameType === 'extra' && ( <div> <h3 className="text-lg font-semibold mb-1">エクストラアクション {gameData?.currentExtraModePhase === 'declaration' && "(宣言フェーズ)"}</h3>
                        {gameData?.currentExtraModePhase === 'declaration' && !myPlayerState?.hasDeclaredThisTurn && (
                            <div className="space-y-1 mt-1">
                                <ActionButton actionType="move" label="移動" iconComp={Move} currentSelection={selectedAction} onSelect={() => {setSelectedAction('move'); setShowActionDetails(true); setIsPlacingTrap(false);}} />
                                <ActionButton actionType="scout" label="偵察" iconComp={Search} currentSelection={selectedAction} onSelect={() => {setSelectedAction('scout'); setShowActionDetails(true); setIsPlacingTrap(false);}} />
                                <ActionButton actionType="sabotage" label="妨害" iconComp={Zap} currentSelection={selectedAction} onSelect={() => {setSelectedAction('sabotage'); setShowActionDetails(true); setIsPlacingTrap(sabotageType === 'trap');}} />
                                <ActionButton actionType="negotiate" label="交渉" iconComp={Handshake} currentSelection={selectedAction} onSelect={() => {setSelectedAction('negotiate'); setShowActionDetails(true); setIsPlacingTrap(false);}} />
                                <ActionButton actionType="wait" label="待機" iconComp={Hourglass} currentSelection={selectedAction} onSelect={() => {setSelectedAction('wait'); setShowActionDetails(false); setIsPlacingTrap(false);}} />
                                
                                {showActionDetails && selectedAction && (selectedAction === 'move' || selectedAction === 'scout' || selectedAction === 'sabotage' || selectedAction === 'negotiate') && (
                                    <div className="my-1 p-2 border rounded bg-gray-50 text-xs">
                                        { (selectedAction === 'scout' || (selectedAction === 'sabotage' && SABOTAGE_TYPES.find(s=>s.id===sabotageType)?.needsPlayerTarget) || (selectedAction === 'negotiate' && negotiationDetails.type !== 'betrayal')) &&
                                            (<> <label className="block font-medium text-gray-700">対象プレイヤー:</label>
                                            <select value={actionTarget || ""} onChange={(e) => setActionTarget(e.target.value)} className="mt-1 block w-full pl-2 pr-8 py-1 border-gray-300 rounded-md">
                                                <option value="">-- 選択 --</option> {gameData.players.filter(p => p !== userId && !(myPlayerState?.allianceId && gameData.alliances?.find(a=>a.id === myPlayerState.allianceId)?.members.includes(p) && (selectedAction === 'sabotage' && NEGOTIATION_TYPES.find(nt=>nt.id===gameData.alliances.find(a=>a.id === myPlayerState.allianceId)?.type)?.id === 'non_aggression'))).map(pId => ( <option key={pId} value={pId}>{pId.substring(0,8)}...</option> ))}
                                            </select> </>)
                                        }
                                        {selectedAction === 'move' && ( /* UI for move target selection, e.g., direction or cell */ <p className="text-gray-600">移動先を選択してください（UI未実装）</p> )}
                                        {selectedAction === 'sabotage' && (
                                            <div className="mt-1"> <label className="block font-medium text-gray-700">妨害タイプ:</label>
                                                {SABOTAGE_TYPES.map(st => (<button key={st.id} onClick={()=>{setSabotageType(st.id); setIsPlacingTrap(st.id === 'trap'); if(st.id === 'trap')setMessage("トラップ設置座標をマップから選択してください。");}} className={`mr-1 mt-1 px-1.5 py-0.5 rounded ${sabotageType === st.id ? 'bg-red-500 text-white' : 'bg-red-200 text-red-700'}`}>{st.label}</button>))}
                                                {sabotageType === 'trap' && <p className="text-blue-600 text-2xs mt-1">{trapPlacementCoord ? `選択座標: (${trapPlacementCoord.r}, ${trapPlacementCoord.c})` : "マップから設置座標を選択..."}</p>}
                                            </div>
                                        )}
                                        {selectedAction === 'negotiate' && (
                                            <div className="mt-1 space-y-1"> <label className="block font-medium text-gray-700">交渉タイプ:</label>
                                                {NEGOTIATION_TYPES.map(nt => (<button key={nt.id} onClick={()=>setNegotiationDetails(prev => ({...prev, type: nt.id, duration: nt.duration}))} className={`mr-1 mt-1 px-1.5 py-0.5 rounded ${negotiationDetails.type === nt.id ? 'bg-pink-500 text-white' : 'bg-pink-200 text-pink-700'}`}>{nt.label}</button>))}
                                                {negotiationDetails.type === 'betrayal' && <p className="text-orange-600 text-2xs mt-1">現在の同盟を破棄します。</p>}
                                                {negotiationDetails.type && negotiationDetails.type !== 'betrayal' && (<> <label className="block font-medium text-gray-700 mt-1">追加条件 (任意):</label> <input type="text" value={negotiationDetails.conditions} onChange={e => setNegotiationDetails(prev => ({...prev, conditions: e.target.value}))} placeholder="例: 壁情報を3つ教える" className="w-full p-1 border rounded"/> </>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button onClick={handleDeclareAction} disabled={!selectedAction || ((selectedAction === 'scout' || (selectedAction === 'sabotage' && SABOTAGE_TYPES.find(s=>s.id===sabotageType)?.needsPlayerTarget) || (selectedAction === 'negotiate' && negotiationDetails.type !== 'betrayal')) && !actionTarget) || (selectedAction === 'sabotage' && !sabotageType) || (selectedAction === 'sabotage' && sabotageType === 'trap' && !trapPlacementCoord) || (selectedAction === 'negotiate' && !negotiationDetails.type) }
                                    className="w-full mt-2 p-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50">宣言を確定</button>
                            </div>
                        )}
                        {gameData?.currentExtraModePhase === 'declaration' && myPlayerState?.hasDeclaredThisTurn && ( <p className="text-sm text-green-600 p-2 bg-green-50 rounded text-center">あなたは「{gameData.declarations[userId]?.type}」を宣言しました。他プレイヤー待ち。</p> )}
                         {gameData?.currentExtraModePhase !== 'declaration' && ( <p className="text-sm text-gray-500 p-2 text-center">現在は「{gameData?.currentExtraModePhase}」フェーズです。 {gameData?.currentExtraModePhase === 'actionExecution' && `実行中: ${gameData.currentActionPlayerId ? gameData.currentActionPlayerId.substring(0,5) : '-'}`} </p> )}
                    </div> )}
                    <div className="border-t pt-2"> {/* Chat Area */} <h3 className="text-lg font-semibold mb-1">Open Chat</h3> <div ref={chatLogRef} className="h-32 overflow-y-auto border rounded p-2 bg-gray-50 text-xs mb-2"> {chatMessages.map(msg => ( <div key={msg.id} className={`mb-1 ${msg.senderId === userId ? 'text-right' : 'text-left'}`}> <span className={`px-2 py-1 rounded-lg inline-block ${msg.senderId === userId ? 'bg-blue-500 text-white' : (msg.senderId === 'system' ? 'bg-yellow-200 text-yellow-800 font-semibold' : 'bg-gray-200 text-gray-800')}`}> {msg.senderId !== 'system' && <strong className="font-semibold">{msg.senderName}: </strong>} {msg.text} </span> </div> ))} </div> <div className="flex space-x-2"> <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="メッセージを入力..." className="flex-grow border p-2 rounded-md text-sm" disabled={myPlayerState?.sabotageEffects?.find(eff => eff.type === 'info_jam' && eff.expiryRound >= gameData?.roundNumber) || (gameData?.specialEventActive?.type === 'communication_jam' && gameData.specialEventActive.visibleUntilRound >= gameData.roundNumber)} onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()} /> <button onClick={() => handleSendChatMessage()} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-md" disabled={myPlayerState?.sabotageEffects?.find(eff => eff.type === 'info_jam' && eff.expiryRound >= gameData?.roundNumber) || (gameData?.specialEventActive?.type === 'communication_jam' && gameData.specialEventActive.visibleUntilRound >= gameData.roundNumber)}><Send size={20}/></button> </div> </div>
                     {gameType === 'extra' && gameData?.actionLog && gameData.actionLog.length > 0 && (
                        <div className="border-t pt-2 mt-2">
                            <h3 className="text-lg font-semibold mb-1">公開アクションログ</h3>
                            <ul className="text-xs bg-gray-50 p-2 rounded max-h-24 overflow-y-auto">
                                {gameData.actionLog.slice(-5).map((log, idx) => (
                                    <li key={idx} className="mb-0.5">
                                        <span className="font-semibold">R{log.round}:</span> {log.resultSummary}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
            {gameData.status === "finished" && ( <button onClick={() => { setIsGameOverModalOpen(true); }} className="mt-6 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-6 rounded-lg text-lg"> 結果を見る </button> )}
        </div>
    );
};

function App() { /* ... (same as previous version) ... */ 
    const [screen, setScreen] = useState('lobby'); const [userId, setUserId] = useState(null); const [isAuthReady, setIsAuthReady] = useState(false); const [gameMode, setGameMode] = useState('2player'); 
    useEffect(() => { const initAuth = async () => { try { onAuthStateChanged(auth, async (user) => { if (user) setUserId(user.uid); else { if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { try { await signInWithCustomToken(auth, __initial_auth_token); } catch (customTokenError) { console.error("Error signing in with custom token, falling back to anonymous:", customTokenError); await signInAnonymously(auth); } } else { await signInAnonymously(auth); } } setIsAuthReady(true); }); } catch (error) { console.error("Firebase Auth Error:", error); setIsAuthReady(true);  } }; initAuth(); }, []);
    useEffect(() => { if(isAuthReady && userId) { const storedGameId = localStorage.getItem('labyrinthGameId'); if (storedGameId) { const gameDocRef = doc(db, `artifacts/${appId}/public/data/labyrinthGames`, storedGameId); getDoc(gameDocRef).then(docSnap => { if (docSnap.exists()) { const game = docSnap.data(); if (!game.players || !game.players.includes(userId)) { localStorage.removeItem('labyrinthGameId'); localStorage.removeItem('labyrinthGameType'); return; } setGameMode(game.mode); if (game.status === "creating") setScreen('courseCreation'); else if (game.status === "playing" || game.status === "finished" || (game.gameType === "extra" && game.currentExtraModePhase)) setScreen('play'); else { localStorage.removeItem('labyrinthGameId'); localStorage.removeItem('labyrinthGameType'); } } else { localStorage.removeItem('labyrinthGameId'); localStorage.removeItem('labyrinthGameType'); } }).catch(error => { console.error("Error checking for existing game:", error); localStorage.removeItem('labyrinthGameId'); localStorage.removeItem('labyrinthGameType'); }); } } }, [isAuthReady, userId]);
    if (!isAuthReady) return <div className="flex items-center justify-center min-h-screen bg-slate-800 text-white text-xl">認証情報を読み込み中...</div>;
    if (!userId && isAuthReady) return <div className="flex items-center justify-center min-h-screen bg-slate-800 text-white text-xl">認証に失敗。リロードしてください。</div>;
    switch (screen) { case 'courseCreation': return <CourseCreationScreen userId={userId} setScreen={setScreen} gameMode={gameMode} />; case 'play': return <PlayScreen userId={userId} setScreen={setScreen} gameMode={gameMode}  />; default: return <LobbyScreen setGameMode={setGameMode} setScreen={setScreen} userId={userId} />; }
}
export default App;
