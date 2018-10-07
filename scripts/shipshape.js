import Sequelize, { Op } from 'sequelize';

const sequelize = new Sequelize('shipshape', null, null, {
    dialect: 'sqlite',
    storage: './shipshape.sqlite3',
    operatorsAliases: Op,
    logging: false
});

const getSquareIdx = (x, y) => y * 10 + x;

const Player = sequelize.define('player', {
   alexaUid: {
       type: Sequelize.STRING,
       unique: true
   }
});
Player.prototype.getAllMatches = function () {
    return Match.findAll({
        include: [
            {
                model: Player,
                where: {
                    id: {
                        [Op.eq]: Sequelize.col('Player.id')
                    }
                }
            }
        ]
    });
};
Player.prototype.getActiveMatch = function () {
    return Match.findOne({
        include: [
            {
                model: Player,
                where: {
                    id: {
                        [Op.eq]: Sequelize.col('Player.id')
                    }
                }
            }
        ],
        where: {
            endTime: {
                [Op.eq]: null
            }
        }
    });
};
Player.prototype.getOrStartMatch = async function (opponentIfNew) {
    let match = await this.getActiveMatch();
    let created = match === null;
    if (created)
        match = await this.startMatch(opponentIfNew);
    return [match, created];
}
Player.prototype.getMatchHistory = function () {
    return Match.findAll({
        include: [
            {
                model: Player,
                where: {
                    id: {
                        [Op.eq]: Sequelize.col('Player.id')
                    }
                }
            }
        ],
        where: {
            endTime: {
                [Op.not]: null
            }
        }
    });
};
Player.prototype.startMatch = function (opponent) {
    return new Promise((resolve, reject) => {
        this.getActiveMatch().then((existingMatch) => {
            if (existingMatch === null) {
                Match.create({
                    aiOpponentType: opponent,
                    humanBoard: '.'.repeat(100),
                    aiBoard: '.'.repeat(100),
                    startTime: Date.now(),
                    playerId: this.id
                }).then((newMatch) => resolve(newMatch));
            } else
                reject(Error(`Match already in progress.`));
        });
    });
};

const Match = sequelize.define('match', {
    aiOpponentType: {
        type: Sequelize.STRING
    },
    humanBoard: {
        type: Sequelize.STRING
    },
    aiBoard: {
        type: Sequelize.STRING
    },
    aiWin: {
        type: Sequelize.BOOLEAN
    },
    startTime: {
        type: Sequelize.DATE
    },
    endTime: {
        type: Sequelize.DATE
    }
});
Match.belongsTo(Player);
Match.prototype.getPlayerShips = function(ai) {
    return Ship.findAll({
        include: [
            {
                model: Match,
                where: {
                    id: {
                        [Op.eq]: Sequelize.col('Match.id')
                    }
                }
            }
        ],
        where: {
            ai: {
                [Op.eq]: ai
            }
        }
    });
};
Match.prototype.getUnplacedShips = function(ai) {
    let ships = {
        Carrier: 5,
        Battleship: 4,
        Submarine: 3,
        Cruiser: 3,
        Destroyer: 2
    };
    return new Promise((resolve, reject) => {
        this.getPlayerShips(ai).then((playerShips) => {
            for (let ship of playerShips) {
                if (ships.hasOwnProperty(ship.name) && ship.length === ships[ship.name])
                    delete ships[ship.name];
                else
                    reject(`Unknown ship ${ship.name} (${ship.length})`);
            }
            resolve(ships);
        });
    });
};
Match.prototype.checkShipUnplaced = function(name, length, ai) {
    return new Promise((resolve, reject) => {
        this.getUnplacedShips(ai).then((unplaced) => {
            if (unplaced.hasOwnProperty(name))
                if (unplaced[name] === length)
                    resolve();
                else
                    reject(`Expected ${name} to be length ${unplaced[name]}, not ${length}`);
            else
                reject(`Ship ${name} invalid or already placed.`);
        });
    });
};
Match.prototype.checkShipOverlap = async function(newShip) {
    let ships = await this.getPlayerShips(newShip.ai);
    for (let ship of ships) {
        for (let square of ship.getSquares()) {
            let [x, y] = square;
            for (let newSquare of newShip.getSquares()) {
                let [newX, newY] = newSquare;
                if (x === newX && y === newY) {
                    throw new Error(`Overlaps with ${ship.name} at ${'ABCDEFGHIJ'[x]}${y + 1}!`);
                }
            }
        }
    }
};
Match.prototype.placeShip = async function(name, length, x, y, vertical, ai) {
    await this.checkShipUnplaced(name, length, ai);
    if (x < 0 || y < 0 || x >= 10 || y >= 10) {
        throw new Error('Ship off board');
    }
    if (vertical) {
        if ((y + length) > 10) {
            throw new Error('Ship off board');
        }
    } else {
        if ((x + length) > 10) {
            throw new Error('Ship off board');
        }
    }
    let newShip = Ship.build({
        name: name,
        length: length,
        x: x,
        y: y,
        vertical: vertical,
        ai: ai,
        matchId: this.id
    });
    await this.checkShipOverlap(newShip);
    return newShip.save();
};
Match.prototype.makeMove = async function(x, y, ai) {
    let boardToCheck = (ai) ? this.humanBoard : this.aiBoard;
    let squareToCheck = getSquareIdx(x, y);
    if (boardToCheck[squareToCheck] === '.') {
        let hit = null;
        for (let ship of await this.getPlayerShips(!ai)) {
            if (await ship.checkHit(x, y)) {
                hit = ship;
            }
        }
        boardToCheck = boardToCheck.split('');
        boardToCheck[squareToCheck] = (hit !== null) ? 'x' : 'o';
        boardToCheck = boardToCheck.join('');
        if (ai)
            this.humanBoard = boardToCheck;
        else
            this.aiBoard = boardToCheck;
        await this.save();
        return hit;
    } else {
        throw new Error('Already a move here');
    }
};
Match.prototype.checkWin = function(ai) {
    return new Promise((resolve, reject) => {
        this.getPlayerShips(!ai).then((ships) => {
            for (let ship of ships) {
                if (!ship.checkSunk()) {
                    resolve(false);
                    return;
                }
            }
            this.endTime = new Date();
            this.aiWin = ai;
            this.save().then(() => resolve(true)).catch((error) => reject(error));
        }).catch((error) => reject(error));
    });
};

const Ship = sequelize.define('ship', {
    name: {
        type: Sequelize.STRING
    },
    x: {
        type: Sequelize.INTEGER
    },
    y: {
        type: Sequelize.INTEGER
    },
    length: {
        type: Sequelize.INTEGER
    },
    vertical: {
        type: Sequelize.BOOLEAN
    },
    ai: {
        type: Sequelize.BOOLEAN
    },
    hits: {
        type: Sequelize.INTEGER,
        defaultValue: 0
    }
});
Ship.belongsTo(Match);
Ship.prototype.getSquares = function() {
    let squares = [];
    for (let i = 0; i < this.length; i++)
        if (this.vertical)
            squares.push([this.x, this.y + i]);
        else
            squares.push([this.x + i, this.y]);
    return squares;
};
Ship.prototype.checkHit = async function(x, y) {
    for (let [sX, sY] of this.getSquares()) {
        if (sX === x && sY === y) {
            await this.increment('hits', {by: 1});
            await this.save();
            return true;
        }
    }
    return false;
};
Ship.prototype.checkSunk = function() {
    return this.length === this.hits;
};

const syncDb = () => new Promise((resolve) => {
    Player.sync().then(() => {
        console.log('Player model create success');
        Match.sync().then(() => {
            console.log('Match object create success');
            Ship.sync().then(() => {
                console.log('Ship model create success');
                resolve();
            });
        });
    });
});

export { Player, Match, Ship, syncDb, getSquareIdx };