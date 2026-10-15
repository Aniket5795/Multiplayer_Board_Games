const ticTacToe = require("./ticTacToe/rules");

const gameRegistry = {
  "tic-tac-toe": ticTacToe,
};

function getGame(gameId) {
  return gameRegistry[gameId] ?? null;
}

module.exports = {
  gameRegistry,
  getGame,
};
