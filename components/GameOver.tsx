
import React, { useState, useEffect } from 'react';
import { GameState, MetricType, LeaderboardEntry } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { COLORS } from '../constants';
import { Trophy, Skull, RefreshCcw, Siren, Save, User } from 'lucide-react';
import { getLeaderboard, saveScore } from '../utils/storage';
import { Leaderboard } from './Leaderboard';

interface GameOverProps {
  gameState: GameState;
  onRestart: () => void;
  onFinalBailout: () => void;
  bailoutUnlocked: boolean;
}

export const GameOver: React.FC<GameOverProps> = ({ gameState, onRestart, onFinalBailout, bailoutUnlocked }) => {
  const { history, status, resilienceScore, gameOverReason, difficulty, finalBailoutUsed } = gameState;
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [currentEntryId, setCurrentEntryId] = useState<string | undefined>(undefined);

  const isVictory = status === 'VICTORY';
  // Bailout condition: Must have lost (unlocked), not used it this game yet, not submitted score, and currently be in a loss state
  const canRescue = !isVictory && !finalBailoutUsed && bailoutUnlocked && !submitted;

  // Prepare chart data
  const chartData = history.map(h => ({
    round: h.round,
    [MetricType.MORALE]: h.metrics[MetricType.MORALE],
    [MetricType.FINANCES]: h.metrics[MetricType.FINANCES],
    [MetricType.SUPPLY_CHAIN]: h.metrics[MetricType.SUPPLY_CHAIN],
    [MetricType.PUBLIC_IMAGE]: h.metrics[MetricType.PUBLIC_IMAGE],
  }));

  let title = isVictory ? "Company Saved!" : "Bankruptcy Declared";
  let subtitle = isVictory 
    ? "You successfully navigated the crisis period." 
    : gameOverReason || "Indicators fell below critical levels.";

  // Victory Tier
  let tier = "Failed State";
  if (isVictory) {
    const finalMetrics = history[history.length - 1].metrics;
    const minVal = Math.min(...(Object.values(finalMetrics) as number[]));
    if (minVal >= 6) tier = "Legendary CEO";
    else if (minVal >= 5) tier = "Stable Leadership";
    else tier = "Survivalist";
  } else {
    tier = "Bankrupt";
  }

  // Load leaderboard on mount
  useEffect(() => {
    setLeaderboardData(getLeaderboard());
  }, []);

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newEntry: LeaderboardEntry = {
      id: Date.now().toString(),
      name: playerName.trim(),
      score: resilienceScore,
      tier: tier,
      date: new Date().toISOString(),
      difficulty: difficulty
    };

    saveScore(newEntry);
    setLeaderboardData(getLeaderboard()); // Refresh local data
    setCurrentEntryId(newEntry.id);
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 animate-fade-in">
      <div className={`p-8 text-center ${isVictory ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
        {isVictory ? (
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-green-400 w-10 h-10" />
          </div>
        ) : (
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Skull className="text-red-400 w-10 h-10" />
          </div>
        )}
        
        <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
        <p className="text-xl text-slate-300 mb-6">{subtitle}</p>
        
        {isVictory && (
          <div className="inline-block px-4 py-2 bg-slate-900 rounded-lg border border-slate-600 text-cyan-400 font-bold mb-6">
            {tier}
          </div>
        )}

        <div className="flex justify-center gap-8 text-center">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Final Score</div>
            <div className="text-3xl font-mono font-bold text-white">{resilienceScore}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Difficulty</div>
            <div className="text-3xl font-mono font-bold text-white">{difficulty}</div>
          </div>
        </div>
      </div>

      <div className="p-8">
        
        {/* Bailout Section - Hidden if score submitted */}
        {canRescue && (
            <div className="mb-8 p-5 bg-indigo-900/20 border border-indigo-500/50 rounded-xl relative overflow-hidden animate-pulse-slow">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h4 className="text-indigo-400 font-bold flex items-center gap-2 mb-2 text-lg">
                    <Siren className="animate-pulse w-5 h-5" /> 
                    Government Intervention Available
                </h4>
                <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                The federal government is offering a one-time emergency rescue package. 
                This will reset critical metrics to 3.0, but your Resilience Score will be <strong>halved</strong>.
                </p>
                <button 
                    onClick={onFinalBailout} 
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-900/50 hover:shadow-indigo-700/50 flex justify-center gap-2 items-center"
                >
                    Accept Final Bailout & Continue
                </button>
            </div>
        )}

        {/* Score Submission Form */}
        {!submitted ? (
           <div className="mb-8 bg-slate-900/50 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                 <Save className="text-cyan-400 w-5 h-5" /> Record Your Legacy
              </h3>
              <form onSubmit={handleSubmitScore} className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                   <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                   <input 
                     type="text" 
                     placeholder="Enter CEO Name" 
                     maxLength={20}
                     value={playerName}
                     onChange={(e) => setPlayerName(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                     required
                   />
                </div>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!playerName.trim()}
                >
                  Save Score
                </button>
              </form>
           </div>
        ) : (
           <div className="mb-8">
              <Leaderboard entries={leaderboardData} currentEntryId={currentEntryId} />
           </div>
        )}

        <h3 className="text-lg font-bold text-slate-300 mb-4">Performance Trend</h3>
        <div className="h-64 w-full mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="round" stroke="#94a3b8" />
              <YAxis domain={[0, 10]} stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#f1f5f9' }} 
              />
              <Legend />
              <Line type="monotone" dataKey={MetricType.MORALE} stroke={COLORS[MetricType.MORALE]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={MetricType.FINANCES} stroke={COLORS[MetricType.FINANCES]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={MetricType.SUPPLY_CHAIN} stroke={COLORS[MetricType.SUPPLY_CHAIN]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={MetricType.PUBLIC_IMAGE} stroke={COLORS[MetricType.PUBLIC_IMAGE]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <button 
          onClick={onRestart}
          className="w-full py-4 bg-slate-700 hover:bg-cyan-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border border-slate-600 hover:border-cyan-400"
        >
          <RefreshCcw size={20} />
          {isVictory ? 'Play Again' : 'Restart Game'}
        </button>
      </div>
    </div>
  );
};
