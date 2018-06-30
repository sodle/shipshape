'use babel';

import React from 'react';
import ReactDOM from 'react-dom';
import { Player, Match, Ship, syncDb } from '../scripts/shipshape';
import { getSquareCoordinates } from "../scripts/ai";

const aiType = 'fry';

class BoardView extends React.Component {
    render() {
        let squares = [];
        for (let i = 0; i < 100; i++) {
            let coord = getSquareCoordinates(i);
            squares.push(<Square x={coord[0]} y={coord[1]} ai={this.props.ai} match={this.props.match}
                                 ship={null} hit={this.props.boardString[i]} />);
        }
        if (this.props.ships !== null) {
            for (let i in this.props.ships) {

            }
        }
    }
}

class MatchView extends React.Component {
    constructor() {
        super();
        this.state = {
            match: null
        };
    }
    render() {
        console.log(this.state.match);
        if (this.state.match !== null)
            return <div>Match: {this.state.match.id}!</div>;
        else
            return <div>No match loaded!</div>;
    }
    componentWillMount() {
        this.props.player.getActiveMatch().then((match) => {
            console.log(match);
            if (match !== null)
                this.setState({
                    match: match
                });
            else
                this.props.player.startMatch(aiType).then((match) => {
                    match.save().then(() => {
                        this.setState({
                            match: match
                        });
                    });
                });
        });
    }
}

class Main extends React.Component {
    constructor() {
        super();
        this.state = {
            player: null
        };
    }
    render() {
        console.log(this.state.player);
        if (this.state.player !== null)
            return (
                <div>
                    <h2>Hello player {this.state.player.alexaUid}</h2>
                    <MatchView player={this.state.player}/>
                </div>
            );
        else
            return <div>No player loaded!</div>;
    }
    componentWillMount() {
        Player.findOrCreate({where : {
            alexaUid: 'electron-test'
        }}).then((players, created) => {
            if (created) {
                players[0].save().then(() => {
                    this.setState({
                        player: players[0]
                    });
                });
                console.log('Created!');
            } else
                this.setState({
                    player: players[0]
                });
        })
    }
}

syncDb().then(() => {
    ReactDOM.render(
        <Main />,
        document.getElementById('app')
    );
});
