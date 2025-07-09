/**
 * ゲーム終了モーダルコンポーネント
 * ゲーム終了時に最終結果とランキングを表示するモーダル
 */

import React from 'react';
import { Trophy, CheckCircle, XCircle, TimerIcon } from 'lucide-react';
import { EXTRA_MODE_PERSONAL_TIME_LIMIT, PERSONAL_TIME_PENALTY_INTERVAL, PERSONAL_TIME_PENALTY_POINTS } from '../constants';

/**
 * ゲーム終了モーダルコンポーネント
 * @param {boolean} isOpen - モーダルの開閉状態
 * @param {Object} gameData - ゲームデータ
 * @param {string} userId - 現在のユーザーID
 * @param {Function} onClose - モーダルを閉じる関数
 */
const GameOverModal = ({ isOpen, gameData, userId, onClose }) => {
    // モーダルが閉じているか必要なデータがない場合は何も表示しない
    if (!isOpen || !gameData || !gameData.playerStates) return null;

    // プレイヤーをランキング順にソート
    const sortedPlayers = (gameData.players || [])
        .map(pid => ({ id: pid, ...gameData.playerStates[pid] }))
        .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity) || (b.score || 0) - (a.score || 0));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
            <div className="bg-white p-6 md:p-8 rounded-lg shadow-2xl w-full max-w-md text-center transform transition-all duration-300 ease-in-out scale-100">
                <h2 className="text-3xl font-bold mb-4 text-indigo-600 flex items-center justify-center">
                    <Trophy size={32} className="mr-2 text-yellow-400"/>ゲーム終了！
                </h2>
                <h3 className="text-xl font-semibold mb-2 text-gray-700">最終結果:</h3>
                {gameData.gameType === 'extra' && gameData.gameTimerEnd && gameData.gameTimerEnd.toMillis() <= Date.now() && 
                    <p className="text-sm text-red-600 mb-3 animate-pulse">(全体制限時間切れにより終了)</p>
                }
                <ul className="space-y-2 text-left text-sm max-h-[50vh] overflow-y-auto pr-2">
                    {sortedPlayers.map((p, index) => (
                        <li key={p.id} className={`p-3 rounded-md shadow-sm ${p.id === userId ? 'bg-blue-100 ring-2 ring-blue-600' : 'bg-gray-50 border'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-lg text-indigo-700">{p.rank || index + 1}位: {p.id.substring(0,8)}...</span>
                                <span className="font-bold text-xl text-indigo-700">{p.score || 0} pt</span>
                            </div>
                            {p.secretObjective && (
                                <div className="text-xs mt-1 pl-1 border-l-2 border-purple-200">
                                    <span className="font-semibold text-purple-600">秘密目標:</span> {p.secretObjective.text} 
                                    {p.secretObjective.achieved ? 
                                        <CheckCircle size={14} className="inline ml-1 text-green-500" title="達成済"/> : 
                                        <XCircle size={14} className="inline ml-1 text-red-500" title="未達成"/>}
                                    {p.secretObjective.achieved && <span className="text-green-600 font-semibold"> (+{p.secretObjective.points}pt)</span>}
                                </div>
                            )}
                            {p.personalTimeUsed > EXTRA_MODE_PERSONAL_TIME_LIMIT && gameData.gameType === 'extra' &&
                                <p className="text-xs text-red-600 pl-1 mt-0.5"><TimerIcon size={12} className="inline"/> 時間超過ペナルティ: {Math.floor((p.personalTimeUsed - EXTRA_MODE_PERSONAL_TIME_LIMIT) / PERSONAL_TIME_PENALTY_INTERVAL) * PERSONAL_TIME_PENALTY_POINTS}pt</p>
                            }
                            {/* TODO: Display other specific bonus/penalty details if desired */}
                        </li>
                    ))}
                </ul>
                <button 
                    onClick={onClose}
                    className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                >
                    ロビーに戻る
                </button>
            </div>
        </div>
    );
};

export default GameOverModal;
