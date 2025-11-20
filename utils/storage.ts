import { LeaderboardEntry } from '../types';

const STORAGE_KEY = 'crisis_game_leaderboard';

export const getLeaderboard = (): LeaderboardEntry[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load leaderboard", error);
    return [];
  }
};

export const saveScore = (entry: LeaderboardEntry): void => {
  try {
    const currentBoard = getLeaderboard();
    const newBoard = [...currentBoard, entry];
    
    // Sort by score descending
    newBoard.sort((a, b) => b.score - a.score);
    
    // Keep top 50 to avoid storage bloat
    const trimmedBoard = newBoard.slice(0, 50);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedBoard));
  } catch (error) {
    console.error("Failed to save score", error);
  }
};
