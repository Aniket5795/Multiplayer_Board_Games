import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  createGame,
  applyMove,
  chooseComputerMove,
} from "./games/ticTacToe/logic";
import ChessGame from "./games/chess/ChessGame";
import "./App.css";

const SERVER_URL = import.meta.env.DEV
  ? "http://localhost:3001"
  : window.location.origin;

export default function App() {
  const socketRef = useRef(null);
  const [selectedGame, setSelectedGame] = useState("tic-tac-toe");

  const [mode, setMode] = useState("computer");
  const [difficulty, setDifficulty] = useState("medium");
  const [localGame, setLocalGame] = useState(createGame);
  const [localScores, setLocalScores] = useState({ X: 0, O: 0 });

  const [roomInput, setRoomInput] = useState("GAME123");
  const [roomCode, setRoomCode] = useState("");
  const [symbol, setSymbol] = useState("");
  const [players, setPlayers] = useState([]);
  const [onlineGame, setOnlineGame] = useState(createGame);
  const [onlineScores, setOnlineScores] = useState({ X: 0, O: 0 });
  const [rematchVotes, setRematchVotes] = useState(0);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Choose a game mode to begin.");

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setMessage("Connected to the game server.");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setMessage("Disconnected from the game server.");
    });

    socket.on("connect_error", () => {
      setMessage("Cannot connect. Check that the server is running.");
    });

    socket.on("roomUpdate", (data) => {
      setPlayers(data.players);
      setOnlineGame(data.game);
      setOnlineScores(data.scores);
      setRematchVotes(data.rematchVotes);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Automatically make the computer's move in single-player mode.
  useEffect(() => {
    if (
      mode !== "computer" ||
      localGame.currentPlayer !== "O" ||
      localGame.winner ||
      localGame.draw
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const index = chooseComputerMove(localGame.board, difficulty);
      const next = applyMove(localGame, index);

      setLocalGame(next);

      if (next.winner === "O") {
        setLocalScores((scores) => ({ ...scores, O: scores.O + 1 }));
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    mode,
    difficulty,
    localGame.board,
    localGame.currentPlayer,
    localGame.winner,
    localGame.draw,
  ]);

  const activeGame = mode === "computer" ? localGame : onlineGame;
  const activeScores = mode === "computer" ? localScores : onlineScores;
  const roundOver = Boolean(activeGame.winner || activeGame.draw);

  function handleLocalMove(index) {
    if (localGame.currentPlayer !== "X") return;

    const next = applyMove(localGame, index);
    if (next === localGame) return;

    setLocalGame(next);

    if (next.winner === "X") {
      setLocalScores((scores) => ({ ...scores, X: scores.X + 1 }));
    }
  }

  function joinRoom() {
    if (!connected) {
      setMessage("Wait for the game server to connect.");
      return;
    }

    socketRef.current.emit("joinRoom", roomInput, (response) => {
      if (!response?.ok) {
        setMessage(response?.message || "Could not join this room.");
        return;
      }

      setRoomCode(response.roomCode);
      setSymbol(response.symbol);
      setMode("online");
      setMessage(`Joined room ${response.roomCode} as ${response.symbol}.`);
    });
  }

  function handleOnlineMove(index) {
    if (!roomCode || !symbol) return;

    socketRef.current.emit("makeMove", index);
  }

  function startNewRound() {
    if (mode === "computer") {
      setLocalGame(createGame());
      return;
    }

    setMessage("Both online players must agree to a rematch.");
    socketRef.current.emit("requestRematch");
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setMessage("Room code copied. Share it with your friend.");
    } catch {
      setMessage(`Share this room code with your friend: ${roomCode}`);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);

    if (nextMode === "computer") {
      setMessage("You are X. The computer is O.");
    } else {
      setMessage(
        roomCode
          ? `Online room: ${roomCode}`
          : "Create or join a room to play online.",
      );
    }
  }

  const status = activeGame.winner
    ? activeGame.winner === "X"
      ? mode === "computer"
        ? "You win!"
        : "Player X wins!"
      : mode === "computer"
        ? "Computer wins!"
        : "Player O wins!"
    : activeGame.draw
      ? "It's a draw!"
      : mode === "computer"
        ? activeGame.currentPlayer === "X"
          ? "Your turn"
          : "Computer is thinking…"
        : !players.every((player) => player?.connected)
          ? "Waiting for both players to connect…"
          : `Player ${activeGame.currentPlayer}'s turn`;

  return (
    <main className="app">
      <header className="app-header">
        <p className="eyebrow">MULTIPLAYER BOARD GAMES</p>
        <h1>Tic-Tac-Toe</h1>
        <p className="subtitle">
          Challenge the computer or play online with a friend.
        </p>
      </header>

      <div className="game-selector">
        <button
          className={selectedGame === "tic-tac-toe" ? "active" : ""}
          onClick={() => setSelectedGame("tic-tac-toe")}
        >
          Tic-Tac-Toe
        </button>

        <button
          className={selectedGame === "chess" ? "active" : ""}
          onClick={() => setSelectedGame("chess")}
        >
          Chess
        </button>
      </div>

      {selectedGame === "chess" ? (
        <ChessGame />
      ) : (
        <>
          <section className="mode-panel">
            <h2>Choose your mode</h2>
            <div className="mode-buttons">
              <button
                className={
                  mode === "computer" ? "mode-button selected" : "mode-button"
                }
                onClick={() => changeMode("computer")}
              >
                Computer vs User
              </button>
              <button
                className={
                  mode === "online" ? "mode-button selected" : "mode-button"
                }
                onClick={() => changeMode("online")}
              >
                Online Multiplayer
              </button>
            </div>

            {mode === "computer" ? (
              <div className="difficulty-row">
                <label htmlFor="difficulty">Computer difficulty</label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            ) : (
              <div className="room-panel">
                <label htmlFor="room-code">Room code</label>
                <div className="room-controls">
                  <input
                    id="room-code"
                    value={roomInput}
                    onChange={(event) =>
                      setRoomInput(event.target.value.toUpperCase())
                    }
                    maxLength={12}
                    placeholder="Enter 3–12 letters or numbers"
                  />
                  <button onClick={joinRoom} disabled={!connected}>
                    Join room
                  </button>
                </div>
                {roomCode && (
                  <div className="room-share">
                    <span>
                      Room: <strong>{roomCode}</strong> · You are {symbol}
                    </span>
                    <button className="secondary-button" onClick={copyRoomCode}>
                      Copy code
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="game-panel">
            <div className="game-status">
              <span className="status-dot" />
              <span>{status}</span>
            </div>

            <div className="scoreboard">
              <div
                className={
                  activeGame.currentPlayer === "X" && !roundOver
                    ? "score-card active"
                    : "score-card"
                }
              >
                <span className="score-symbol">X</span>
                <span>{mode === "computer" ? "You" : "Player X"}</span>
                <strong>{activeScores.X}</strong>
              </div>
              <div className="score-card">
                <span className="score-symbol">O</span>
                <span>{mode === "computer" ? "Computer" : "Player O"}</span>
                <strong>{activeScores.O}</strong>
              </div>
            </div>

            <div className="board" role="group" aria-label="Tic-Tac-Toe board">
              {activeGame.board.map((cell, index) => (
                <button
                  key={index}
                  className={[
                    "square",
                    cell ? `square-${cell.toLowerCase()}` : "",
                    activeGame.winningLine.includes(index)
                      ? "winning-square"
                      : "",
                  ].join(" ")}
                  onClick={() =>
                    mode === "computer"
                      ? handleLocalMove(index)
                      : handleOnlineMove(index)
                  }
                  disabled={
                    Boolean(cell) ||
                    roundOver ||
                    (mode === "computer" && localGame.currentPlayer !== "X") ||
                    (mode === "online" &&
                      (!roomCode ||
                        !symbol ||
                        !players.every((player) => player?.connected) ||
                        onlineGame.currentPlayer !== symbol))
                  }
                  aria-label={`Square ${index + 1}${cell ? `, ${cell}` : ", empty"}`}
                >
                  {cell}
                </button>
              ))}
            </div>

            {roundOver && (
              <div className="result-message">
                {activeGame.winner
                  ? `${
                      activeGame.winner === "X"
                        ? mode === "computer"
                          ? "You"
                          : "Player X"
                        : mode === "computer"
                          ? "The computer"
                          : "Player O"
                    } won this round.`
                  : "The round ended in a draw."}
              </div>
            )}

            <button
              className="primary-button"
              onClick={startNewRound}
              disabled={mode === "online" && !roundOver}
            >
              {mode === "computer" ? "Play again" : "Request rematch"}
            </button>

            <p className="message" aria-live="polite">
              {message}
            </p>
          </section>
        </>
      )}

      <footer className="footer">
        <span>Computer mode runs locally in your browser.</span>
        <span>Online mode uses your Socket.IO server.</span>
      </footer>
    </main>
  );
}
