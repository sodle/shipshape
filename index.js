import { Player, Match, Ship, syncDb } from './scripts/shipshape';
import { getSquareCoordinates } from "./scripts/ai";
import { Op } from 'sequelize';
import clear from 'clear';
import figlet from 'figlet';

const aiType = 'fry';

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
}

syncDb().then(runCLI);