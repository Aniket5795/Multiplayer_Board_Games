export const gameRegistry = [
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    status: "available",
    modes: ["computer", "online"],
    description: "Play X and O against the computer or another player.",
  },
  {
    id: "chess",
    name: "Chess",
    status: "planned",
    modes: ["computer", "online"],
    description:
      "A strategy game with legal piece movement and checkmate rules.",
  },
  {
    id: "ludo",
    name: "Ludo",
    status: "planned",
    modes: ["computer", "online"],
    description: "A dice-based board game with multiple players and tokens.",
  },
];

export function getGameById(gameId) {
  return gameRegistry.find((game) => game.id === gameId) ?? null;
}
