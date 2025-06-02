// src/components/MazeGrid.jsx
import React from 'react';
import { User, UserCheck, Skull } from 'lucide-react';
import { STANDARD_GRID_SIZE } from '../constants'; // Assuming constants are in ../constants.js

const MazeGrid = ({
    mazeData,
    playerPosition,
    showAllWalls,
    wallSettings,
    onWallClick,
    isCreating,
    startPos,
    goalPos,
    onCellClick,
    revealedCells = {},
    revealedPlayerWalls = [],
    smallView = false,
    highlightPlayer = true,
    otherPlayers = [],
    gridSize = STANDARD_GRID_SIZE,
    traps = [],
    selectingTrapCoord = false,
    onTrapCoordSelect,
    alliedPlayersPos = [],
    sharedWallsFromAllies = [],
    showAllPlayerPositions = false
}) => {
    if (!isCreating && !mazeData && !smallView) return <div className="text-center p-4">迷路データを読み込み中...</div>;
    if (smallView && !mazeData) return <div className="text-center p-1 text-xs">データなし</div>;

    const wallsToConsider = isCreating ? wallSettings : mazeData?.walls;

    let baseCellSize = 'w-12 h-12 md:w-16 md:h-16';
    if (gridSize > 7) baseCellSize = 'w-8 h-8 md:w-10 md:h-10';
    if (gridSize > 10) baseCellSize = 'w-7 h-7 md:w-8 md:h-8';

    const cellSize = smallView ? (gridSize > 7 ? 'w-5 h-5 md:w-6 md:h-6' : 'w-6 h-6 md:w-8 md:h-8') : baseCellSize;
    const iconSize = smallView ? (gridSize > 7 ? 10 : 12) : (gridSize > 7 ? 16 : 24);
    const textSize = smallView ? 'text-2xs md:text-xs' : (gridSize > 7 ? 'text-xs' : 'text-sm');

    const renderCellContent = (r, c) => {
        if (isCreating) {
            if (startPos && startPos.r === r && startPos.c === c) return <span className={`font-bold ${textSize} text-green-700`}>S</span>;
            if (goalPos && goalPos.r === r && goalPos.c === c) return <span className={`font-bold ${textSize} text-red-700`}>G</span>;
            return null;
        }

        const playersOnThisCell = otherPlayers.filter(p => p.position.r === r && p.position.c === c);
        const trapOnCell = traps.find(t => t.r === r && t.c === c && t.mazeOwnerId === mazeData?.ownerId);
        const isAlliedPlayerOnCell = alliedPlayersPos.find(p => p.r === r && p.c === c);

        let cellPlayerIcons = [];
        if (highlightPlayer && playerPosition && playerPosition.r === r && playerPosition.c === c) {
            cellPlayerIcons.push(<User key="mainPlayer" size={iconSize} className="text-white z-10" />);
        }
        
        if (showAllPlayerPositions && !smallView) {
            otherPlayers.forEach(p => {
                if (p.position.r === r && p.position.c === c && (!playerPosition || p.id !== playerPosition.id) ) {
                     cellPlayerIcons.push(<User key={p.id} size={iconSize * 0.7} className="text-orange-400 opacity-90 absolute" title={p.id.substring(0,5)} style={{left: `${Math.random()*20+40}%`, top: `${Math.random()*20+40}%`}} />);
                }
            });
        } else {
            if (isAlliedPlayerOnCell && !smallView) {
                 if (!highlightPlayer || !playerPosition || playerPosition.r !==r || playerPosition.c !==c) { // Avoid double if main player is allied
                    cellPlayerIcons.push(<UserCheck key={`ally-${isAlliedPlayerOnCell.id}`} size={iconSize * 0.8} className="text-green-500 opacity-80 absolute z-5" title={`Allied: ${isAlliedPlayerOnCell.id.substring(0,5)}`} />);
                 }
            }
            if (playersOnThisCell.length > 0 && !smallView) {
                playersOnThisCell.forEach(p => {
                    if (!highlightPlayer || !playerPosition || playerPosition.r !== r || playerPosition.c !== c) {
                         if (!alliedPlayersPos.find(ap => ap.id === p.id && ap.r === r && ap.c ===c))
                            cellPlayerIcons.push(<User key={p.id} size={iconSize * 0.8} className="text-purple-400 opacity-70 absolute" title={p.id.substring(0,5)} />);
                    }
                });
            }
        }
        
        if (trapOnCell && !smallView && (!playerPosition || playerPosition.r !==r || playerPosition.c !== c)) {
            cellPlayerIcons.push(<Skull key="trap" size={iconSize * 0.7} className="text-red-500 opacity-60 absolute z-0" title={`Trap by ${trapOnCell.ownerId.substring(0,5)}`} />);
        }

        if (mazeData?.start?.r === r && mazeData?.start?.c === c) return <><span className={`font-bold ${textSize} text-green-700`}>S</span>{cellPlayerIcons}</>;
        if (mazeData?.goal?.r === r && mazeData?.goal?.c === c) return <><span className={`font-bold ${textSize} text-red-700`}>G</span>{cellPlayerIcons}</>;
        return cellPlayerIcons.length > 0 ? <>{cellPlayerIcons}</> : null;
    };

    const hasWallBetween = (r1, c1, r2, c2) => {
        if (!wallsToConsider && (!sharedWallsFromAllies || sharedWallsFromAllies.length === 0)) return false;
        let wallR, wallC, wallType;
        if (r1 === r2) { wallType = 'vertical'; wallR = r1; wallC = Math.min(c1, c2); }
        else { wallType = 'horizontal'; wallR = Math.min(r1, r2); wallC = c1; }
        
        const definingWall = wallsToConsider?.find(w => w.type === wallType && w.r === wallR && w.c === wallC && w.active);
        const sharedWall = sharedWallsFromAllies?.find(w => w.type === wallType && w.r === wallR && w.c === wallC && w.active);

        if (isCreating || smallView) return !!definingWall;
        if (showAllWalls) return !!definingWall || !!sharedWall;
        
        const revealedWall = revealedPlayerWalls.find(w => w.type === wallType && w.r === wallR && w.c === wallC && w.active);
        return !!revealedWall || !!sharedWall;
    };

    return (
        <div className={`grid grid-cols-1 gap-0 ${smallView ? 'border' : 'border-2'} border-black bg-gray-50 rounded-md shadow-lg`} style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`}}>
            {Array(gridSize).fill(0).map((_, r) =>
                Array(gridSize).fill(0).map((_, c) => {
                    const cellKey = `${r}-${c}`;
                    let cellClasses = `${cellSize} flex items-center justify-center relative`;

                    if (isCreating) {
                        if (startPos && startPos.r === r && startPos.c === c) cellClasses += " bg-green-300";
                        else if (goalPos && goalPos.r === r && goalPos.c === c) cellClasses += " bg-red-300";
                        else cellClasses += " hover:bg-gray-100 cursor-pointer";
                    } else if (!smallView) {
                        if (highlightPlayer && playerPosition && playerPosition.r === r && playerPosition.c === c) cellClasses += " bg-blue-400 transition-colors duration-300";
                        else if (mazeData?.start?.r === r && mazeData?.start?.c === c) cellClasses += " bg-green-200";
                        else if (mazeData?.goal?.r === r && mazeData?.goal?.c === c) cellClasses += " bg-red-200";
                        else if (revealedCells[`${r}-${c}`]) cellClasses += " bg-yellow-100";
                        else cellClasses += " bg-gray-50";
                    } else { // smallView
                        if (highlightPlayer && playerPosition && playerPosition.r === r && playerPosition.c === c) cellClasses += " bg-blue-300";
                        else if (mazeData?.start?.r === r && mazeData?.start?.c === c) cellClasses += " bg-green-100";
                        else if (mazeData?.goal?.r === r && mazeData?.goal?.c === c) cellClasses += " bg-red-100";
                        else cellClasses += " bg-gray-100";
                    }
                    if (selectingTrapCoord && onTrapCoordSelect && !isCreating && !smallView) {
                        cellClasses += " cursor-crosshair hover:bg-red-200/50";
                    }

                    let borderStyles = "";
                    const wallBorderThickness = gridSize > 7 ? 'border' : 'border-2';
                    const wallBorder = smallView ? 'border-black' : `border-black ${wallBorderThickness}`;
                    const pathBorder = smallView ? 'border-gray-300' : 'border-gray-300';
                    const outerBorderThickness = gridSize > 7 ? 'border-black' : 'border-t-2 border-t-black';

                    if (r === 0) borderStyles += ` border-t ${gridSize > 7 && smallView ? 'border-black' : outerBorderThickness}`;
                    else if (hasWallBetween(r,c,r-1,c)) borderStyles += ` border-t ${wallBorder}`; else borderStyles += ` border-t ${pathBorder}`;
                    
                    if (r === gridSize - 1) borderStyles += ` border-b ${gridSize > 7 && smallView ? 'border-black' : `border-b-2 border-b-black`}`;
                    else if (hasWallBetween(r,c,r+1,c)) borderStyles += ` border-b ${wallBorder}`; else borderStyles += ` border-b ${pathBorder}`;

                    if (c === 0) borderStyles += ` border-l ${gridSize > 7 && smallView ? 'border-black' : `border-l-2 border-l-black`}`;
                    else if (hasWallBetween(r,c,r,c-1)) borderStyles += ` border-l ${wallBorder}`; else borderStyles += ` border-l ${pathBorder}`;

                    if (c === gridSize - 1) borderStyles += ` border-r ${gridSize > 7 && smallView ? 'border-black' : `border-r-2 border-r-black`}`;
                    else if (hasWallBetween(r,c,r,c+1)) borderStyles += ` border-r ${wallBorder}`; else borderStyles += ` border-r ${pathBorder}`;
                    
                    cellClasses += ` ${borderStyles}`;

                    return (
                        <div
                            key={cellKey}
                            className={cellClasses}
                            onClick={() => {
                                if (isCreating && onCellClick) onCellClick(r, c);
                                if (selectingTrapCoord && onTrapCoordSelect) onTrapCoordSelect(r, c);
                            }}
                        >
                            {renderCellContent(r,c)}
                            {isCreating && onWallClick && !smallView && (
                                <>
                                    {r < gridSize - 1 && (
                                        <div title={`H-wall (${r},${c})`}
                                            className={`absolute bottom-[-4px] left-0 w-full h-[8px] cursor-pointer hover:bg-blue-300/50 z-10 ${wallSettings && wallSettings.find(w=>w.type==='horizontal' && w.r===r && w.c===c)?.active ? 'bg-black/50' : 'bg-gray-300/30'}`}
                                            onClick={(e) => { e.stopPropagation(); onWallClick(r, c, 'horizontal'); }}
                                        />
                                    )}
                                    {c < gridSize - 1 && (
                                        <div title={`V-wall (${r},${c})`}
                                            className={`absolute top-0 right-[-4px] w-[8px] h-full cursor-pointer hover:bg-blue-300/50 z-10 ${wallSettings && wallSettings.find(w=>w.type==='vertical' && w.r===r && w.c===c)?.active ? 'bg-black/50' : 'bg-gray-300/30'}`}
                                            onClick={(e) => { e.stopPropagation(); onWallClick(r, c, 'vertical'); }}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
};

export default MazeGrid;
