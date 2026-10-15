function createGame() {
  return {
    board: Array(9).fill(null),
    currentPlayer: "X",
    winner: null,
    draw: false,
    winningLine: [],
  };
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 4, 8],
    [2, 4, 6],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
  ];

  for (const line of lines) {
    const [a, b, c] = line;

    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return {
        winner: board[a],
        winningLine: line,
      };
    }
  }

  return {
    winner: null,
    winningLine: [],
  };
}

function applyMove(game, index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8 ||
    game.board[index] !== null ||
    game.winner ||
    game.draw
  ) {
    return game;
  }

  const board = [...game.board];
  board[index] = game.currentPlayer;

  const result = checkWinner(board);
  const draw = !result.winner && board.every(Boolean);

  return {
    board,
    currentPlayer:
      result.winner || draw
        ? game.currentPlayer
        : game.currentPlayer === "X"
          ? "O"
          : "X",
    winner: result.winner,
    draw,
    winningLine: result.winningLine,
  };
}

module.exports = {
  createGame,
  applyMove,
};
