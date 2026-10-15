function createRoom(createGame, gameId = "tic-tac-toe") {
  const scores = gameId === "chess" ? { w: 0, b: 0 } : { X: 0, O: 0 };

  return {
    gameId,
    players: [null, null],
    game: createGame(),
    scores,
    rematchVotes: new Set(),
  };
}

function getPlayerIndex(room, socketId) {
  return room.players.findIndex((player) => player?.id === socketId);
}

function getPlayerSymbol(gameId, index) {
  if (gameId === "chess") {
    return index === 0 ? "w" : "b";
  }

  return index === 0 ? "X" : "O";
}

function publicRoomState(room) {
  return {
    gameId: room.gameId,
    players: room.players.map((player, index) => ({
      symbol: getPlayerSymbol(room.gameId, index),
      connected: Boolean(player),
      rematchRequested: Boolean(player && room.rematchVotes.has(player.id)),
    })),
    game: room.game,
    scores: room.scores,
    rematchVotes: room.rematchVotes.size,
  };
}

function broadcastRoom(io, rooms, roomCode) {
  const room = rooms.get(roomCode);

  if (room) {
    io.to(roomCode).emit("roomUpdate", publicRoomState(room));
  }
}

module.exports = {
  createRoom,
  getPlayerIndex,
  publicRoomState,
  broadcastRoom,
};
