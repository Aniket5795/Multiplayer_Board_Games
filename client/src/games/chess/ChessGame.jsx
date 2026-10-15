import "./ChessGame.css";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import ChessBoard from "./ChessBoard";
import "./ChessBoard.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export default function ChessGame() {
  const [roomCode, setRoomCode] = useState("CHESS101");
  const [joined, setJoined] = useState(false);
  const [symbol, setSymbol] = useState(null);
  const [room, setRoom] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [message, setMessage] = useState("Join a room to start.");
  const [connection, setConnection] = useState("Connecting...");

  const [socket] = useState(() => io(SERVER_URL, { autoConnect: false }));

  useEffect(() => {
    function onConnect() {
      setConnection("Connected");
    }

    function onDisconnect() {
      setConnection("Disconnected");
      setJoined(false);
      setRoom(null);
    }

    function onRoomUpdate(nextRoom) {
      if (nextRoom.gameId !== "chess") return;

      setRoom(nextRoom);
      setSelectedSquare(null);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("roomUpdate", onRoomUpdate);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("roomUpdate", onRoomUpdate);
      socket.disconnect();
    };
  }, [socket]);

  function joinRoom() {
    if (!socket.connected) {
      setMessage("Waiting for the server connection.");
      return;
    }

    socket.emit("joinChessRoom", roomCode, (response) => {
      if (!response?.ok) {
        setMessage(response?.message || "Could not join the room.");
        return;
      }

      setJoined(true);
      setSymbol(response.symbol);
      setMessage(
        `Joined ${response.roomCode} as ${
          response.symbol === "w" ? "White" : "Black"
        }.`,
      );
    });
  }

  function selectSquare(square, chess) {
    if (!joined || !room) return;

    const game = room.game;

    if (game.winner || game.draw) return;
    if (game.currentPlayer !== symbol) {
      setMessage("Wait for your turn.");
      return;
    }

    const piece = chess.get(square);

    if (!selectedSquare) {
      if (!piece || piece.color !== symbol) {
        setMessage("Select one of your own pieces.");
        return;
      }

      setSelectedSquare(square);
      setMessage(`Selected ${square}. Choose a destination.`);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    // Allow changing selection to another piece of your own color.
    if (piece?.color === symbol) {
      setSelectedSquare(square);
      return;
    }

    const moves = chess.moves({
      square: selectedSquare,
      verbose: true,
    });

    const candidate = moves.find((move) => move.to === square);

    if (!candidate) {
      setMessage("That is not a legal move. Try another square.");
      setSelectedSquare(null);
      return;
    }

    let promotion = candidate.promotion;

    if (candidate.flags.includes("p")) {
      const choice = window.prompt(
        "Promote pawn to q (queen), r (rook), b (bishop), or n (knight):",
        "q",
      );

      if (choice === null) {
        setSelectedSquare(null);
        return;
      }

      promotion = choice.trim().toLowerCase();

      if (!["q", "r", "b", "n"].includes(promotion)) {
        setMessage("Invalid promotion choice.");
        return;
      }
    }

    socket.emit("makeChessMove", {
      from: selectedSquare,
      to: square,
      ...(promotion ? { promotion } : {}),
    });

    setSelectedSquare(null);
    setMessage("Move submitted.");
  }

  function requestRematch() {
    socket.emit("requestRematch");
  }

  const game = room?.game;
  const gameOver = Boolean(game?.winner || game?.draw);
  const isMyTurn = Boolean(joined && game?.currentPlayer === symbol);

  return (
    <section className="chess-game">
      <h2>Chess — Online Multiplayer</h2>

      <p>Connection: {connection}</p>

      <div className="chess-room-controls">
        <label>
          Room code
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            maxLength={12}
            disabled={joined}
          />
        </label>

        <button
          type="button"
          onClick={joinRoom}
          disabled={joined || !socket.connected}
        >
          Join Chess Room
        </button>
      </div>

      <p>{message}</p>

      {joined && room && (
        <>
          <p>
            You are: <strong>{symbol === "w" ? "White" : "Black"}</strong>
          </p>

          <p>
            {room.players.filter((player) => player.connected).length}
            {" / 2 players connected"}
          </p>

          <p>
            {gameOver
              ? game.winner
                ? `${game.winner === "w" ? "White" : "Black"} wins by checkmate!`
                : `Game ended: ${game.status}`
              : isMyTurn
                ? `Your turn — ${symbol === "w" ? "White" : "Black"}`
                : `Waiting for ${game.currentPlayer === "w" ? "White" : "Black"}`}
          </p>

          <ChessBoard
            fen={game.fen}
            orientation={symbol}
            selectedSquare={selectedSquare}
            onSelectSquare={selectSquare}
            disabled={!isMyTurn || gameOver}
            lastMove={game.lastMove}
          />

          <p>Game status: {game.status}</p>

          <p>
            Score — White: {room.scores.w} | Black: {room.scores.b}
          </p>

          {gameOver && (
            <button type="button" onClick={requestRematch}>
              Request Rematch
            </button>
          )}

          {room.rematchVotes > 0 && (
            <p>Rematch votes: {room.rematchVotes} / 2</p>
          )}
        </>
      )}
    </section>
  );
}
