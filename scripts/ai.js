import { Ship } from './shipshape';

const randInt = (max) => Math.floor(Math.random() * max);
const randBool = () => Math.random() > .5;
const getSquareCoordinates = (idx) => [idx % 10, Math.floor(idx / 10)];
const getSquareIdx = ([x, y]) => y * 10 + x;

const placeShipRandomly = (length) => {
    let vertical = randBool();
    let maxX = (vertical) ? 10 : 10 - length;
    let maxY = (vertical) ? 10 - length : 10;
    return [vertical, randInt(maxX), randInt(maxY)]
};

// Random move generator
const fry = async (match) => {
    let board = match.humanBoard;
    let idx = randInt(100);
    while (board[idx] !== '.')
        idx = randInt(100);
    return getSquareCoordinates(idx);
};

const bender = async (match) => {
    let moves = await match.listAiMoves();
    if (moves.length === 0)
        return await fry(match);
    if (moves[0].shipId === null)
        return await fry(match);
    let lastShip = await Ship.findOne({where: {id: moves[0].shipId}});
    if (await lastShip.checkSunk())
        return await fry(match);
    if (moves[1].shipId !== null) {
        if (moves[1].x === moves[0].x - 1) {
            if (moves[0].x < 9) {
                let idx = getSquareIdx([moves[0].x + 1, moves[0].y]);
                if (match.humanBoard[idx] === '.') {
                    return [moves[0].x + 1, moves[0].y];
                } else {
                    return await fry(match);
                }
            } else {
                return await fry(match);
            }
        }
        if (moves[1].x === moves[0].x + 1) {
            if (moves[0].x > 0) {
                let idx = getSquareIdx([moves[0].x - 1, moves[0].y]);
                if (match.humanBoard[idx] === '.') {
                    return [moves[0].x - 1, moves[0].y];
                } else {
                    return await fry(match);
                }
            } else {
                return await fry(match);
            }
        }
        if (moves[1].y === moves[0].y - 1) {
            if (moves[0].y < 9) {
                let idx = getSquareIdx([moves[0].x, moves[0].y + 1]);
                if (match.humanBoard[idx] === '.') {
                    return [moves[0].x + 1, moves[0].y];
                } else {
                    return await fry(match);
                }
            } else {
                return await fry(match);
            }
        }
        if (moves[1].y === moves[0].y + 1) {
            if (moves[0].y > 0) {
                let idx = getSquareIdx([moves[0].x, moves[0].y - 1]);
                if (match.humanBoard[idx] === '.') {
                    return [moves[0].x - 1, moves[0].y];
                } else {
                    return await fry(match);
                }
            } else {
                return await fry(match);
            }
        }
    }
    if (moves[0].shipId !== null) {
        if (moves[0].x < 9) {
            let idx = getSquareIdx([moves[0].x + 1, moves[0].y]);
            if (match.humanBoard[idx] === '.') {
                return [moves[0].x + 1, moves[0].y];
            }
        }
        if (moves[0].x > 0) {
            let idx = getSquareIdx([moves[0].x - 1, moves[0].y]);
            if (match.humanBoard[idx] === '.') {
                return [moves[0].x - 1, moves[0].y];
            }
        }
        if (moves[0].y < 9) {
            let idx = getSquareIdx([moves[0].x, moves[0].y + 1]);
            if (match.humanBoard[idx] === '.') {
                return [moves[0].x, moves[0].y + 1];
            }
        }
        if (moves[0].y > 0) {
            let idx = getSquareIdx([moves[0].x, moves[0].y - 1]);
            if (match.humanBoard[idx] === '.') {
                return [moves[0].x, moves[0].y - 1];
            }
        }
    }
    return await fry(match);
};

export { placeShipRandomly, fry, getSquareCoordinates, bender }