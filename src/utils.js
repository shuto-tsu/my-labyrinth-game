// src/utils.js

export function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }
    return array;
}

export const createInitialWallStates = (gridSize) => {
    const walls = [];
    // Horizontal walls
    for (let r = 0; r < gridSize - 1; r++) {
        for (let c = 0; c < gridSize; c++) {
            walls.push({ r, c, type: 'horizontal', active: false });
        }
    }
    // Vertical walls
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize - 1; c++) {
            walls.push({ r, c, type: 'vertical', active: false });
        }
    }
    return walls;
};

export const isPathPossible = (start, goal, walls, gridSize) => {
    if (!start || !goal) return false;
    const queue = [[start.r, start.c]];
    const visited = new Set([`${start.r}-${start.c}`]);
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // R, L, D, U

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        if (r === goal.r && c === goal.c) return true;

        for (const [dr, dc] of directions) {
            const nr = r + dr;
            const nc = c + dc;

            if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize && !visited.has(`${nr}-${nc}`)) {
                let wallExists = false;
                if (dr === 0) { // Moving horizontally
                    const wallC = Math.min(c, nc);
                    if (walls.find(w => w.type === 'vertical' && w.r === r && w.c === wallC && w.active)) {
                        wallExists = true;
                    }
                } else { // Moving vertically
                    const wallR = Math.min(r, nr);
                     if (walls.find(w => w.type === 'horizontal' && w.r === wallR && w.c === c && w.active)) {
                        wallExists = true;
                    }
                }
                if (!wallExists) {
                    visited.add(`${nr}-${nc}`);
                    queue.push([nr, nc]);
                }
            }
        }
    }
    return false;
};

export const formatTime = (seconds) => {
    if (seconds === null || seconds < 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
