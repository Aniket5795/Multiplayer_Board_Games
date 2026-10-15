function createRoom(createGame) {
  return {
    players: [null, null],
    game: createGame(),
    scores: { X: 0, O: 0 },
    rematchVotes: new Set(),
  };
}

function getPlayerIndex(room, socketId) {
  return room.players.findIndex((player) => player?.id === socketId);
}

function publicRoomState(room) {
  return {
    players: room.players.map((player, index) => ({
      symbol: index === 0 ? "X" : "O",
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
