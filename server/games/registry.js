const ticTacToe = require("./ticTacToe/rules");
const chess = require("./chess/rules");

const gameRegistry = {
  "tic-tac-toe": ticTacToe,
  chess,
};

function getGame(gameId) {
  return gameRegistry[gameId] ?? null;
}

module.exports = {
  gameRegistry,
  getGame,
};
