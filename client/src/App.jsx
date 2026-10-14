import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SERVER_URL = import.meta.env.DEV
  ? "http://localhost:3001"
  : window.location.origin;

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
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const line of lines) {
    const [a, b, c] = line;

    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: line };
    }
  }

  return { winner: null, winningLine: [] };
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

function chooseComputerMove(board, difficulty) {
  const available = board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index !== -1);

  if (available.length === 0) return -1;

  if (difficulty === "easy") {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Medium: win immediately or block an immediate human win.
  if (difficulty === "medium") {
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

  // Hard: choose the best move using minimax.
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

export default function App() {
  const socketRef = useRef(null);

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
                activeGame.winningLine.includes(index) ? "winning-square" : "",
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

      <footer className="footer">
        <span>Computer mode runs locally in your browser.</span>
        <span>Online mode uses your Socket.IO server.</span>
      </footer>
    </main>
  );
}
