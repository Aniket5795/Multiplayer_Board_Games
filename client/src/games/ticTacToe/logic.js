export function createGame() {
  return {
    board: Array(9).fill(null),
    currentPlayer: "X",
    winner: null,
    draw: false,
    winningLine: [],
  };
}

export function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const line of lines) {
    const [a, b, c] = line;

    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
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

export function applyMove(game, index) {
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

function minimax(board, player, depth = 0) {
  const result = checkWinner(board);

  if (result.winner === "O") return 10 - depth;
  if (result.winner === "X") return depth - 10;
  if (board.every(Boolean)) return 0;

  const moves = board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index !== -1);

  if (player === "O") {
    let bestScore = -Infinity;

    for (const index of moves) {
      const nextBoard = [...board];
      nextBoard[index] = "O";

      bestScore = Math.max(bestScore, minimax(nextBoard, "X", depth + 1));
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const index of moves) {
    const nextBoard = [...board];
    nextBoard[index] = "X";

    bestScore = Math.min(bestScore, minimax(nextBoard, "O", depth + 1));
  }

  return bestScore;
}

export function chooseComputerMove(board, difficulty) {
  const available = board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index !== -1);

  if (available.length === 0) return -1;

  if (difficulty === "easy") {
    return available[Math.floor(Math.random() * available.length)];
  }

  if (difficulty === "medium") {
    // First look for a winning move, then a blocking move.
    for (const symbol of ["O", "X"]) {
      for (const index of available) {
        const nextBoard = [...board];
        nextBoard[index] = symbol;

        if (checkWinner(nextBoard).winner === symbol) {
          return index;
        }
      }
    }

    return available[Math.floor(Math.random() * available.length)];
  }

  // Hard mode: use minimax to choose an optimal move.
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const index of available) {
    const nextBoard = [...board];
    nextBoard[index] = "O";

    const score = minimax(nextBoard, "X", 1);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [index];
    } else if (score === bestScore) {
      bestMoves.push(index);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
