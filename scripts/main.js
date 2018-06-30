import React from 'react';
import ReactDOM from 'react-dom';
import Main from '../views/main.jsx';

import { Player } from './shipshape';

window.onload = function(){
  Player.findOrCreate({where: {
    alexaUid: 'electron-test'
  }}).then((players, created) => {
    if (created)
      players[0].save();
    ReactDOM.render(<Main player={player} />, document.getElementById('app'));
  });
}
