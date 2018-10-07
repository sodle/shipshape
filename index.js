import { Player, Match, Ship, syncDb } from './scripts/shipshape';
import { getSquareCoordinates, placeShipRandomly, fry } from "./scripts/ai";
import { Op } from 'sequelize';
import clear from 'clear';
import figlet from 'figlet';
import inquirer from 'inquirer';

const aiType = 'fry';
const ai = fry;

async function printMyShips(match) {
    let ocean = match.humanBoard.match(/.{1,10}/g);
    ocean = ocean.map(r => r.split(''));
    let ships = await match.getPlayerShips(false);
    for (let ship of ships) {
        let squares = ship.getSquares();
        for (let square of squares) {
            let [x, y] = square;
            if (ocean[y][x] === '.')
                ocean[y][x] = '#';
        }
    }
    console.log('   A B C D E F G H I J');
    let i = 1;
    for (let row of ocean) {
        console.log(`${String(i).padStart(2)} ${row.join(' ')}`);
        i++;
    }
}

async function printEnemyShips(match) {
    let ocean = match.aiBoard.match(/.{1,10}/g);
    ocean = ocean.map(r => r.split(''));
    console.log('   A B C D E F G H I J');
    let i = 1;
    for (let row of ocean) {
        console.log(`${String(i).padStart(2)} ${row.join(' ')}`);
        i++;
    }
}

async function runCLI() {
    let [player, playerCreated] = await Player.findOrCreate({
        where: {
            alexaUid: 'cli-test'
        }
    }).spread((player, playerCreated) => [player, playerCreated]);

    clear();
    if (playerCreated)
        console.log('Created player!');

    console.log(
        figlet.textSync('ShipShape', {horizontalLayout: 'full'})
    );

    console.log(`Welcome, ${player.alexaUid}!`);

    let [match, matchCreated] = await player.getOrStartMatch(aiType);

    if (matchCreated)
        console.log(`Created a new match against ${match.aiOpponentType}`);
    else
        console.log(`Resuming match against ${match.aiOpponentType}`);

    let unplacedAi = await match.getUnplacedShips(true);
    unplacedAi = Object.keys(unplacedAi).map(key => [key, unplacedAi[key]]);
    if (unplacedAi.length !== 0) {
        console.log('Placing AI ships.');
        for (let unplacedShip of unplacedAi) {
            let [name, len] = unplacedShip;
            let success = false;
            console.log(`Placing ${name} - ${len}`);
            while (!success) {
                let [vertical, x, y] = placeShipRandomly(len);
                try {
                    await match.placeShip(name, len, x, y, vertical, true);
                    console.log(`Placed ${name}`);
                    success = true;
                } catch(e) {
                    console.log(e);
                }
            }
        }
    }

    let unplacedFriendly = await match.getUnplacedShips(false);
    unplacedFriendly = Object.keys(unplacedFriendly).map(key => [key, unplacedFriendly[key]]);
    if (unplacedFriendly.length !== 0) {
        console.log('You have unplaced ships.');
        for (let unplacedShip of unplacedFriendly) {
            await printMyShips(match);
            let [name, len] = unplacedShip;
            console.log(`Where would you like to place your ${name}? It's ${len} squares long.`);
            let success = false;
            while (!success) {
                let {x, y, vertical} = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'x',
                        message: 'Column (A-J)',
                        validate: i => i.length === 1 && 'ABCDEFGHIJabcdefghij'.includes(i)
                    },
                    {
                        type: 'input',
                        name: 'y',
                        message: 'Row (1-10)',
                        validate: i => parseInt(i) > 0 && parseInt(i) <= 10
                    },
                    {
                        type: 'list',
                        name: 'vertical',
                        message: 'Direction',
                        choices: [
                            {
                                name: 'Horizontal',
                                value: false
                            },
                            {
                                name: 'Vertical',
                                value: true
                            }
                        ]
                    }
                ]);
                x = 'ABCDEFGHIJ'.indexOf(x.toUpperCase());
                y = parseInt(y) - 1;
                try {
                    await match.placeShip(name, len, x, y, vertical, false);
                    console.log(`Placed ${name}`);
                    success = true;
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }
    clear();
    if (await match.checkWin(false)) {
        console.log('You win!');
        return;
    }
    if (await match.checkWin(true)) {
        console.log('The AI wins!');
        return;
    }
    while (true) {
        console.log('Enemy:');
        await printEnemyShips(match);

        console.log();

        console.log('You:');
        await printMyShips(match);

        console.log('It is your turn.');

        let success = false;
        while (!success) {
            let {x, y} = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'x',
                    message: 'Column (A-J)',
                    validate: i => i.length === 1 && 'ABCDEFGHIJabcdefghij'.includes(i)
                },
                {
                    type: 'input',
                    name: 'y',
                    message: 'Row (1-10)',
                    validate: i => parseInt(i) > 0 && parseInt(i) <= 10
                }
            ]);
            x = 'ABCDEFGHIJ'.indexOf(x.toUpperCase());
            y = parseInt(y) - 1;
            try {
                let hitShip = await match.makeMove(x, y, false);
                clear();
                if (hitShip !== null) {
                    if (hitShip.checkSunk()) {
                        console.log(`You sunk the AI's ${hitShip.name}!`);
                    } else {
                        console.log('Hit!');
                    }
                } else {
                    console.log('Miss!');
                }
                success = true;
            } catch (e) {
                console.log(e);
            }
        }

        if (await match.checkWin(false)) {
            console.log('You win!');
            return;
        }

        let [x, y] = ai(match.humanBoard);
        let hitShip = await match.makeMove(x, y, true);
        if (hitShip !== null) {
            if (hitShip.checkSunk()) {
                console.log(`The AI sunk your ${hitShip.name}!`);
            } else {
                console.log('AI hit!');
            }
        } else {
            console.log('AI miss!');
        }

        if (await match.checkWin(true)) {
            console.log('AI wins!');
            return;
        }
    }
}

syncDb().then(runCLI);