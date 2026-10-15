import { useMemo } from "react";
import { Chess } from "chess.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const PIECES = {
  w: {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙",
  },
  b: {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  },
};

export default function ChessBoard({
  fen,
  orientation = "w",
  selectedSquare,
  onSelectSquare,
  disabled = false,
  lastMove,
}) {
  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const ranks =
    orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];

  const files = orientation === "w" ? FILES : [...FILES].reverse();

  function handleSquareClick(square) {
    if (!disabled) {
      onSelectSquare(square, chess);
    }
  }

  return (
    <div className="chess-board" role="grid" aria-label="Chess board">
      {ranks.flatMap((rank, rowIndex) =>
        files.map((file, colIndex) => {
          const square = `${file}${rank}`;
          const piece = chess.get(square);
          const dark = (rowIndex + colIndex) % 2 === 1;

          const isSelected = selectedSquare === square;
          const isLastMove =
            lastMove?.from === square || lastMove?.to === square;

          return (
            <button
              key={square}
              type="button"
              role="gridcell"
              className={[
                "chess-square",
                dark ? "dark" : "light",
                isSelected ? "selected" : "",
                isLastMove ? "last-move" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => handleSquareClick(square)}
              aria-label={
                piece
                  ? `${square}, ${piece.color === "w" ? "White" : "Black"} ${piece.type}`
                  : square
              }
              disabled={disabled}
            >
              {piece && (
                <span
                  className={`chess-piece ${
                    piece.color === "w" ? "white-piece" : "black-piece"
                  }`}
                >
                  {PIECES[piece.color][piece.type]}
                </span>
              )}

              {colIndex === 0 && (
                <span className="chess-rank-label">{rank}</span>
              )}

              {rowIndex === 7 && (
                <span className="chess-file-label">{file}</span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
