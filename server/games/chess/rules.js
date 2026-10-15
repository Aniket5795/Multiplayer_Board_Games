const { Chess } = require("chess.js");

function createGame() {
  const chess = new Chess();

  return {
    fen: chess.fen(),
    pgn: "",
    currentPlayer: "w",
    winner: null,
    draw: false,
    status: "In progress",
    lastMove: null,
  };
}

function applyMove(game, move) {
  if (!move || typeof move.from !== "string" || typeof move.to !== "string") {
    return game;
  }

  // Rebuild the position, including its move history.
  const chess = new Chess();

  try {
    if (game.pgn) {
      chess.loadPgn(game.pgn);
    }

    // chess.js rejects illegal moves.
    const playedMove = chess.move({
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    });

    if (!playedMove) {
      return game;
    }

    const checkmate = chess.isCheckmate();
    const draw = chess.isDraw();

    let status = "In progress";
    let winner = null;

    if (checkmate) {
      winner = chess.turn() === "w" ? "b" : "w";
      status = "Checkmate";
    } else if (draw) {
      status = chess.isStalemate() ? "Stalemate" : "Draw";
    } else if (chess.isCheck()) {
      status = "Check";
    }

    return {
      fen: chess.fen(),
      pgn: chess.pgn(),
      currentPlayer: chess.turn(),
      winner,
      draw,
      status,
      lastMove: {
        from: playedMove.from,
        to: playedMove.to,
        promotion: playedMove.promotion || null,
      },
    };
  } catch (error) {
    // Invalid moves must not change the game.
    return game;
  }
}

module.exports = {
  createGame,
  applyMove,
};
