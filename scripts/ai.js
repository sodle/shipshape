const randInt = (max) => Math.floor(Math.random() * max);
const randBool = () => Math.random() > .5;
const getSquareCoordinates = (idx) => [idx % 10, Math.floor(idx / 10)];

const placeShipRandomly = (length) => {
    let vertical = randBool();
    let maxX = (vertical) ? 10 : 10 - length;
    let maxY = (vertical) ? 10 - length : 10;
    return [vertical, randInt(maxX), randInt(maxY)]
};

// Random move generator
const fry = (board) => {
    let idx = randInt(100);
    while (board[idx] !== '.')
        idx = randInt(100);
    return getSquareCoordinates(idx);
};

export { placeShipRandomly, fry, getSquareCoordinates }