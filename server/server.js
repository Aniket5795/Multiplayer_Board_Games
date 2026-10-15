const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { getGame } = require("./games/registry");

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

function createGameFor(gameId) {
  const gameRules = getGame(gameId);

  if (!gameRules) {
    throw new Error(`Unknown game: ${gameId}`);
  }

  return gameRules.createGame();
}

function getRoomGameRules(room) {
  return getGame(room.gameId);
}

function validRoomCode(rawCode) {
  const roomCode = String(rawCode || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{3,12}$/.test(roomCode)) {
    return null;
  }

  return roomCode;
}

function joinGameRoom(socket, rawCode, gameId, callback) {
  const roomCode = validRoomCode(rawCode);

  if (!roomCode) {
    callback?.({
      ok: false,
      message: "Use 3–12 letters or numbers for the room code.",
    });
    return;
  }

  if (socket.data.roomCode) {
    callback?.({
      ok: false,
      message: "You have already joined a room. Refresh to start again.",
    });
    return;
  }

  const gameRules = getGame(gameId);

  if (!gameRules) {
    callback?.({
      ok: false,
      message: "This game is not available.",
    });
    return;
  }

  let room = rooms.get(roomCode);

  if (room && room.gameId !== gameId) {
    callback?.({
      ok: false,
      message: "This room belongs to a different game.",
    });
    return;
  }

  if (!room) {
    room = createRoom(() => gameRules.createGame(), gameId);
    rooms.set(roomCode, room);
  }

  const playerIndex = room.players.findIndex((player) => player === null);

  if (playerIndex === -1) {
    callback?.({
      ok: false,
      message: "This room already has two players.",
    });
    return;
  }

  const symbol =
    gameId === "chess"
      ? playerIndex === 0
        ? "w"
        : "b"
      : playerIndex === 0
        ? "X"
        : "O";

  room.players[playerIndex] = {
    id: socket.id,
    symbol,
  };

  room.rematchVotes.clear();

  socket.data.roomCode = roomCode;
  socket.join(roomCode);

  callback?.({
    ok: true,
    roomCode,
    symbol,
    gameId,
  });

  broadcastRoom(io, rooms, roomCode);

  console.log(`${socket.id} joined ${roomCode} as ${symbol} (${gameId})`);
}

function handleTicTacToeMove(socket, index) {
  const roomCode = socket.data.roomCode;
  const room = rooms.get(roomCode);

  if (
    !room ||
    room.gameId !== "tic-tac-toe" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 8
  ) {
    return;
  }

  const playerIndex = getPlayerIndex(room, socket.id);

  if (playerIndex === -1 || room.players.some((player) => !player)) {
    return;
  }

  const symbol = playerIndex === 0 ? "X" : "O";
  const gameRules = getRoomGameRules(room);
  const game = room.game;

  if (game.winner || game.draw || game.currentPlayer !== symbol) {
    return;
  }

  const nextGame = gameRules.applyMove(game, index);

  if (nextGame === game) {
    return;
  }

  room.game = nextGame;

  if (!game.winner && nextGame.winner) {
    room.scores[nextGame.winner] += 1;
  }

  room.rematchVotes.clear();

  broadcastRoom(io, rooms, roomCode);
}

function handleChessMove(socket, move) {
  const roomCode = socket.data.roomCode;
  const room = rooms.get(roomCode);

  if (!room || room.gameId !== "chess") {
    return;
  }

  const playerIndex = getPlayerIndex(room, socket.id);

  if (playerIndex === -1 || room.players.some((player) => !player)) {
    return;
  }

  const symbol = playerIndex === 0 ? "w" : "b";
  const game = room.game;

  if (game.winner || game.draw || game.currentPlayer !== symbol) {
    return;
  }

  const gameRules = getRoomGameRules(room);
  const nextGame = gameRules.applyMove(game, move);

  // The rules engine returns the same state for invalid moves.
  if (nextGame === game) {
    return;
  }

  room.game = nextGame;

  if (!game.winner && nextGame.winner) {
    room.scores[nextGame.winner] += 1;
  }

  room.rematchVotes.clear();

  broadcastRoom(io, rooms, roomCode);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Existing Tic-Tac-Toe joining event.
  socket.on("joinRoom", (rawCode, callback) => {
    joinGameRoom(socket, rawCode, "tic-tac-toe", callback);
  });

  // New Chess joining event.
  socket.on("joinChessRoom", (rawCode, callback) => {
    joinGameRoom(socket, rawCode, "chess", callback);
  });

  // Existing Tic-Tac-Toe move event.
  socket.on("makeMove", (index) => {
    handleTicTacToeMove(socket, index);
  });

  // New Chess move event.
  socket.on("makeChessMove", (move) => {
    handleChessMove(socket, move);
  });

  // Shared rematch system for both games.
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
      room.game = createGameFor(room.gameId);
      room.rematchVotes.clear();
    }

    broadcastRoom(io, rooms, roomCode);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) {
      console.log("Disconnected:", socket.id);
      return;
    }

    const playerIndex = getPlayerIndex(room, socket.id);

    if (playerIndex !== -1) {
      room.players[playerIndex] = null;
      room.rematchVotes.clear();
    }

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
