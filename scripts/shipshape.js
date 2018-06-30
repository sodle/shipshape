import Sequelize, { Op } from 'sequelize';

const sequelize = new Sequelize('shipshape', null, null, {
    dialect: 'sqlite',
    storage: './shipshape.sqlite3'
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
                    id: Sequelize.col('Player.id')
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
                    id: Sequelize.col('Player.id')
                }
            }
        ],
        where: {
            endTime: null
        }
    });
};
Player.prototype.getMatchHistory = function () {
    return Match.findAll({
        include: [
            {
                model: Player,
                where: {
                    id: Sequelize.col('Player.id')
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
                    id: Sequelize.col('Match.id')
                }
            }
        ],
        where: {
            ai: ai
        }
    })
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
Match.prototype.checkShipOverlap = function(newShip) {
    return new Promise((resolve, reject) => {
        this.getPlayerShips(newShip.ai)
            .then((ships) => {
                for (let ship of ships)
                    for (let square of ship.getSquares())
                        for (let newSquare of newShip.getSquares())
                            if (square === newSquare)
                                reject(`Overlaps with ${ship.name} at ${square}`);
                resolve();
            });
    });
};
Match.prototype.placeShip = function(name, length, x, y, vertical, ai) {
    return new Promise((resolve, reject) => {
        this.checkShipUnplaced(name, length, ai)
            .then(() => {
                if (x < 0 || y < 0 || x >= 10 || y >= 10)
                    reject('Ship off board');
                if (vertical)
                    if (y + length > 10)
                        reject('Ship off board');
                else
                    if (x + length > 10)
                        reject('Ship off board');
                let newShip = Ship.create({
                    name: name,
                    length: length,
                    x: x,
                    y: y,
                    vertical: vertical,
                    ai: ai,
                    matchId: this.id
                });
                this.checkShipOverlap(newShip)
                    .then(() => {
                        newShip.save().then((ship) => resolve(ship)).catch((error) => reject(error));
                    })
                    .catch((error) => reject(error));
            })
            .catch((error) => reject(error));
    });
};
Match.prototype.makeMove = function(x, y, ai) {
    let boardToCheck = (ai) ? this.aiBoard : this.humanBoard;
    let squareToCheck = getSquareIdx(x, y);
    return new Promise((resolve, reject) => {
        if (boardToCheck[squareToCheck] === '.') {
            for (let ship of this.getPlayerShips(!ai)) {
                ship.checkHit(x, y).then((hit) => {
                    boardToCheck[squareToCheck] = (hit) ? 'x' : 'o';
                    if (ai)
                        this.aiBoard = boardToCheck;
                    else
                        this.humanBoard = boardToCheck;
                    this.save().then(() => resolve((hit) ? ship : null)).catch((error) => reject(error));
                }).catch((error) => reject(error));
            }
        } else {
            reject('Already a move here');
        }
    });
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
        type: Sequelize.INTEGER
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
Ship.prototype.checkHit = function(x, y) {
    return new Promise((resolve, reject) => {
        for (let square of this.getSquares())
            if (square === [x, y]) {
                this.hits.increment().then(() => resolve(true)).catch((error) => reject(error));
            }
        resolve(false);
    });
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