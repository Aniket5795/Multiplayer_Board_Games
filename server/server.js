const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const {
  createRoom,
  getPlayerIndex,
  broadcastRoom,
} = require("./platform/roomManager");

const app = express();
const httpServer = http.createServer(app);

app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map();

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

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("joinRoom", (rawCode, callback) => {
    const roomCode = String(rawCode || "")
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{3,12}$/.test(roomCode)) {
      callback?.({
        ok: false,
        message: "Use 3–12 letters or numbers for the room code.",
      });
      return;
    }

    let room = rooms.get(roomCode);

    if (!room) {
      room = createRoom(createGame);
      rooms.set(roomCode, room);
    }

    // Prevent one socket from joining multiple rooms.
    if (socket.data.roomCode) {
      callback?.({
        ok: false,
        message: "You have already joined a room. Refresh to start again.",
      });
      return;
    }

    // Reuse the first available player slot.
    const playerIndex = room.players.findIndex((player) => player === null);

    if (playerIndex === -1) {
      callback?.({
        ok: false,
        message: "This room already has two players.",
      });
      return;
    }

    const symbol = playerIndex === 0 ? "X" : "O";

    room.players[playerIndex] = {
      id: socket.id,
      symbol,
    };

    // A new player joining invalidates old rematch votes.
    room.rematchVotes.clear();

    socket.data.roomCode = roomCode;
    socket.join(roomCode);

    callback?.({ ok: true, roomCode, symbol });

    broadcastRoom(io, rooms, roomCode);
    console.log(`${socket.id} joined ${roomCode} as ${symbol}`);
  });

  socket.on("makeMove", (index) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room || !Number.isInteger(index) || index < 0 || index > 8) {
      return;
    }

    const playerIndex = getPlayerIndex(room, socket.id);

    if (playerIndex === -1 || room.players.some((p) => !p)) {
      return;
    }

    const symbol = playerIndex === 0 ? "X" : "O";
    const game = room.game;

    if (
      game.winner ||
      game.draw ||
      game.currentPlayer !== symbol ||
      game.board[index] !== null
    ) {
      return;
    }

    game.board[index] = symbol;

    const result = checkWinner(game.board);
    game.winner = result.winner;
    game.winningLine = result.winningLine;

    if (game.winner) {
      room.scores[game.winner] += 1;
    } else if (game.board.every((cell) => cell !== null)) {
      game.draw = true;
    } else {
      game.currentPlayer = symbol === "X" ? "O" : "X";
    }

    // A new round requires new rematch votes.
    room.rematchVotes.clear();

    broadcastRoom(io, rooms, roomCode);
  });

  socket.on("requestRematch", () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room || getPlayerIndex(room, socket.id) === -1) {
      return;
    }

    if (!room.game.winner && !room.game.draw) {
      return;
    }

    room.rematchVotes.add(socket.id);

    const bothPlayersAgreed = room.players.every(
      (player) => player && room.rematchVotes.has(player.id),
    );

    if (bothPlayersAgreed) {
      room.game = createGame();
      room.rematchVotes.clear();
    }

    broadcastRoom(io, rooms, roomCode);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) return;

    const playerIndex = getPlayerIndex(room, socket.id);

    if (playerIndex !== -1) {
      room.players[playerIndex] = null;
      room.rematchVotes.clear();
    }

    // Delete empty rooms to avoid accumulating unused rooms.
    if (room.players.every((player) => player === null)) {
      rooms.delete(roomCode);
    } else {
      broadcastRoom(io, rooms, roomCode);
    }

    console.log("Disconnected:", socket.id);
  });
});

const clientDist = path.join(__dirname, "../client/dist");

app.use(express.static(clientDist));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Serve the React app for browser routes.
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/socket.io")) {
    return next();
  }

  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next(err);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
