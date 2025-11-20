import React from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy, Medal } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentEntryId?: string; // To highlight the just-submitted score
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries, currentEntryId }) => {
  
  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 1) return <Medal className="w-5 h-5 text-slate-300" />; // Silver
    if (rank === 2) return <Medal className="w-5 h-5 text-amber-600" />; // Bronze
    return <span className="font-mono text-slate-500">#{rank + 1}</span>;
  };

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Trophy size={18} className="text-cyan-400"/> Hall of Fame
        </h3>
        <span className="text-xs text-slate-500 uppercase">Top 50 CEOs</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 w-16 text-center">Rank</th>
              <th className="px-4 py-3">CEO Name</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 hidden sm:table-cell">Tier</th>
              <th className="px-4 py-3 hidden sm:table-cell text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                   No records yet. Be the first to make history!
                 </td>
               </tr>
            ) : (
              entries.map((entry, index) => {
                const isCurrent = entry.id === currentEntryId;
                return (
                  <tr 
                    key={entry.id} 
                    className={`hover:bg-slate-800/30 transition-colors ${isCurrent ? 'bg-cyan-900/20 animate-pulse-subtle' : ''}`}
                  >
                    <td className="px-4 py-3 text-center font-bold flex justify-center items-center">
                      {getRankIcon(index)}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${isCurrent ? 'text-cyan-400' : 'text-slate-200'}`}>
                      {entry.name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white">
                      {entry.score}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-400 text-xs">
                      {entry.tier}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-right text-slate-500 text-xs">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
