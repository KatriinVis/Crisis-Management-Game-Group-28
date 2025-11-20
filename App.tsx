import React, { useState, useEffect, useCallback } from 'react';
import { GameState, MetricType, Difficulty, INITIAL_METRICS, Choice, Scenario, MetricState, RoundFeedbackData } from './types';
import { SCENARIOS } from './data/scenarios';
import { Dashboard } from './components/Dashboard';
import { ScenarioView } from './components/ScenarioView';
import { RoundFeedbackView } from './components/RoundFeedbackView';
import { GameOver } from './components/GameOver';
import { DIFFICULTY_SETTINGS, CRITICAL_THRESHOLD } from './constants';
import { ShieldCheck, Target, Clock, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    round: 1,
    maxRounds: 10,
    metrics: JSON.parse(JSON.stringify(INITIAL_METRICS)), // Deep copy
    status: 'IDLE',
    difficulty: Difficulty.NORMAL,
    history: [],
    resilienceScore: 0,
    finalBailoutUsed: false,
    loanTaken: false,
    investorDebuffRounds: 0,
    currentScenario: null,
    loading: false,
    timeLimit: 25
  });

  const [showIntro, setShowIntro] = useState(true);
  const [feedbackToast, setFeedbackToast] = useState<{title: string, items: string[]} | null>(null);
  const [scenarioDeck, setScenarioDeck] = useState<Scenario[]>([]);
  const [bailoutUnlocked, setBailoutUnlocked] = useState(false);

  // Check unlock status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasLost = localStorage.getItem('hasLostGame') === 'true';
      setBailoutUnlocked(hasLost);
    }
  }, []);

  // Shuffle helper
  const shuffleDeck = (array: Scenario[]): Scenario[] => {
    const deck = [...array];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  // Initialize or Next Round
  const startRound = useCallback((currentState: GameState, deck: Scenario[]) => {
    setGameState(prev => ({ ...prev, loading: true, status: 'PLAYING', loanTaken: false }));
    
    // Pick next scenario from deck
    const scenarioIndex = currentState.round - 1;
    
    // Check bounds
    const scenario = scenarioIndex < deck.length ? deck[scenarioIndex] : deck[0];

    // Short artificial delay to simulate transition
    setTimeout(() => {
        setGameState(prev => ({
            ...prev,
            currentScenario: scenario,
            loading: false
        }));
    }, 500);
    
  }, []);

  const startGame = (difficulty: Difficulty) => {
    const settings = DIFFICULTY_SETTINGS[difficulty];
    
    // Create and shuffle deck for this session
    const newDeck = shuffleDeck(SCENARIOS);
    setScenarioDeck(newDeck);

    const initialState: GameState = {
      round: 1,
      maxRounds: settings.rounds,
      metrics: JSON.parse(JSON.stringify(INITIAL_METRICS)),
      status: 'PLAYING',
      difficulty,
      history: [{
          round: 0,
          metrics: {
            [MetricType.MORALE]: 6,
            [MetricType.FINANCES]: 6,
            [MetricType.SUPPLY_CHAIN]: 6,
            [MetricType.PUBLIC_IMAGE]: 6
          },
          eventTitle: "Game Start",
          choiceSelected: "N/A"
      }],
      resilienceScore: 0,
      finalBailoutUsed: false,
      loanTaken: false,
      investorDebuffRounds: 0,
      currentScenario: null,
      loading: true,
      timeLimit: settings.timeLimit
    };
    setGameState(initialState);
    setShowIntro(false);
    startRound(initialState, newDeck);
  };

  const handleChoice = (choice: Choice, isTimeout: boolean = false) => {
    if (!gameState.currentScenario) return;

    setGameState(prev => {
      const newMetrics = { ...prev.metrics };
      const impactStrings: string[] = [];
      let scoreDelta = 0;
      let gameOverReason: string | undefined;

      // Calculate Momentum/Experience Bonus
      // Grows by 0.25 per round. Round 1: +0, Round 5: +1.0, Round 9: +2.0
      const momentumBonus = (prev.round - 1) * 0.25;

      // 1. Apply Impacts
      (Object.keys(choice.impacts) as MetricType[]).forEach(key => {
        const baseImpact = choice.impacts[key];
        
        // Apply volatility based on difficulty
        const volatility = DIFFICULTY_SETTINGS[prev.difficulty].volatility;
        
        // Use float calculation
        let calculatedChange = baseImpact * volatility;

        // Apply Momentum Bonus to everything (Passive Improvement/Resilience)
        calculatedChange += momentumBonus;

        // Apply Debuff: No positive finance gains if debuff active
        if (key === MetricType.FINANCES && prev.investorDebuffRounds > 0 && calculatedChange > 0) {
          calculatedChange = 0;
          impactStrings.push(`Finances frozen by Investors`);
        }

        // Timeout penalty
        if (isTimeout) calculatedChange -= 1;

        const oldValue = newMetrics[key].value;
        let newValue = oldValue + calculatedChange;
        
        // Clamping 0-10
        newValue = Math.max(0, Math.min(10, newValue));
        
        const diff = newValue - oldValue;

        newMetrics[key] = {
          type: key,
          value: newValue,
          delta: diff
        };

        // Record simplified impact string for feedback
        if (Math.abs(diff) > 0.01) {
            const sign = diff > 0 ? '+' : '';
            // Show decimal if it's a fractional change (likely due to bonus)
            const valDisplay = Number.isInteger(diff) ? diff.toString() : diff.toFixed(1);
            impactStrings.push(`${key} ${sign}${valDisplay}`);
        }

        if (newValue !== oldValue) {
           if (newValue > oldValue) scoreDelta += (newValue - oldValue) * 10;
           if (newValue < oldValue) scoreDelta -= (oldValue - newValue) * 5;
        }
      });

      if (momentumBonus > 0 && !isTimeout) {
        impactStrings.push(`Exp. Bonus: +${momentumBonus.toFixed(2)}`);
      }

      if (isTimeout) impactStrings.push("Timeout Penalty (-1 All)");

      // Prepare Feedback Data
      const feedbackData: RoundFeedbackData = {
        scenario: prev.currentScenario!,
        selectedChoiceId: choice.id,
        impacts: impactStrings,
        isTimeout
      };

      // 2. Check Survival
      const failedMetrics = (Object.values(newMetrics) as MetricState[]).filter(m => m.value < CRITICAL_THRESHOLD);
      
      if (failedMetrics.length > 0) {
        gameOverReason = `Critical failure in: ${failedMetrics.map(m => m.type).join(', ')}`;
        
        // Unlock bailout for future runs (and this one immediately) since they lost
        if (typeof window !== 'undefined') {
            localStorage.setItem('hasLostGame', 'true');
        }
        setBailoutUnlocked(true);

        return {
            ...prev,
            metrics: newMetrics,
            status: 'GAME_OVER',
            gameOverReason,
            lastRoundFeedback: feedbackData, // Save feedback even on game over for final bailout view
            history: [...prev.history, {
                round: prev.round,
                metrics: {
                    [MetricType.MORALE]: newMetrics[MetricType.MORALE].value,
                    [MetricType.FINANCES]: newMetrics[MetricType.FINANCES].value,
                    [MetricType.SUPPLY_CHAIN]: newMetrics[MetricType.SUPPLY_CHAIN].value,
                    [MetricType.PUBLIC_IMAGE]: newMetrics[MetricType.PUBLIC_IMAGE].value,
                },
                eventTitle: prev.currentScenario!.title,
                choiceSelected: isTimeout ? "TIMEOUT" : choice.text
            }]
        };
      }

      // 3. Update Rounds & Status
      const nextRound = prev.round + 1;
      
      // Resilience Bonus: All metrics >= 4 gets bonus
      if ((Object.values(newMetrics) as MetricState[]).every(m => m.value >= 4)) scoreDelta += 20;

      // Decrement debuff
      const newDebuff = prev.investorDebuffRounds > 0 ? prev.investorDebuffRounds - 1 : 0;

      const nextState: GameState = {
        ...prev,
        round: nextRound,
        metrics: newMetrics,
        resilienceScore: Math.round(prev.resilienceScore + scoreDelta), // Round score to integer
        investorDebuffRounds: newDebuff,
        status: 'ROUND_FEEDBACK',
        lastRoundFeedback: feedbackData,
        history: [...prev.history, {
            round: prev.round,
            metrics: {
                [MetricType.MORALE]: newMetrics[MetricType.MORALE].value,
                [MetricType.FINANCES]: newMetrics[MetricType.FINANCES].value,
                [MetricType.SUPPLY_CHAIN]: newMetrics[MetricType.SUPPLY_CHAIN].value,
                [MetricType.PUBLIC_IMAGE]: newMetrics[MetricType.PUBLIC_IMAGE].value,
            },
            eventTitle: prev.currentScenario!.title,
            choiceSelected: isTimeout ? "TIMEOUT" : choice.text
        }],
        currentScenario: null
      };

      return nextState;
    });
  };

  const handleNextRound = () => {
    if (gameState.round > gameState.maxRounds) {
      setGameState(prev => ({ ...prev, status: 'VICTORY' }));
    } else {
      startRound(gameState, scenarioDeck);
    }
  };

  const handleTimeout = () => {
      if (!gameState.currentScenario) return;
      const safeChoice = gameState.currentScenario.choices.find(c => c.riskLevel === 'Low') || gameState.currentScenario.choices[0];
      handleChoice(safeChoice, true);
  };

  const handleTakeLoan = () => {
    setGameState(prev => {
      const newMetrics = { ...prev.metrics };
      const currentFinances = newMetrics[MetricType.FINANCES].value;
      
      // Boost Finances
      const newFinanceValue = Math.min(10, currentFinances + 2);
      newMetrics[MetricType.FINANCES] = {
        type: MetricType.FINANCES,
        value: newFinanceValue,
        delta: newFinanceValue - currentFinances
      };

      setFeedbackToast({
        title: "Bank Loan Approved",
        items: [`Finances +${(newFinanceValue - currentFinances).toFixed(1)}`, "Resilience Score -10 (Debt Penalty)"]
      });
      setTimeout(() => setFeedbackToast(null), 3000);

      return {
        ...prev,
        metrics: newMetrics,
        resilienceScore: prev.resilienceScore - 10, // Penalty for taking debt
        loanTaken: true
      };
    });
  };

  const handleFinalBailout = () => {
    setGameState(prev => {
        const newMetrics = { ...prev.metrics };
        // Reset criticals to 3
        (Object.values(newMetrics) as MetricState[]).forEach(m => {
            if (m.value < 2) {
                m.value = 3;
                m.delta = 3 - m.value;
            }
        });
        
        // Proceed to next round logic similar to handleChoice success path
        const nextRound = prev.round + 1;
        const newDebuff = prev.investorDebuffRounds > 0 ? prev.investorDebuffRounds - 1 : 0;

        setFeedbackToast({
            title: "Federal Rescue Accepted",
            items: ["Critical Metrics Reset to 3", "Resilience Score Halved", "Continuing Game..."]
        });
        setTimeout(() => setFeedbackToast(null), 4000);

        return {
            ...prev,
            metrics: newMetrics,
            status: 'ROUND_FEEDBACK', // Show them what happened that almost killed them
            round: nextRound,
            investorDebuffRounds: newDebuff,
            resilienceScore: Math.floor(prev.resilienceScore / 2), // Massive penalty
            finalBailoutUsed: true,
            gameOverReason: undefined
        };
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-cyan-900/10 blur-3xl rounded-full"></div>
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-purple-900/10 blur-3xl rounded-full"></div>
      </div>

      {showIntro ? (
        <div className="max-w-4xl mx-auto mt-6 bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl animate-fade-in">
           <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
             Crisis Management Simulator
           </h1>
           <p className="text-lg text-slate-300 text-center mb-8 leading-relaxed max-w-2xl mx-auto">
             Steer a vulnerable company through a series of randomized crises. Balance trade-offs, manage resources, and survive volatility.
           </p>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
                 <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                    <Target className="text-cyan-400" /> How to Play
                 </h3>
                 <ul className="space-y-3 text-slate-300 text-sm">
                    <li className="flex gap-2"><span className="text-cyan-500 font-bold">1.</span> Each round presents a new Crisis Scenario.</li>
                    <li className="flex gap-2"><span className="text-cyan-500 font-bold">2.</span> You have limited time to choose a response.</li>
                    <li className="flex gap-2"><span className="text-cyan-500 font-bold">3.</span> Every choice affects 4 key company metrics.</li>
                    <li className="flex gap-2"><span className="text-cyan-500 font-bold">4.</span> Keep all metrics above <span className="text-red-400 font-bold">2.0</span> to survive.</li>
                 </ul>
              </div>
              
              <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
                 <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                    <ShieldCheck className="text-green-400" /> Scoring: The Resilience Score
                 </h3>
                 <ul className="space-y-2 text-slate-300 text-xs">
                    <li className="flex justify-between"><span className="text-green-400">Growth Reward:</span> <span>+10 pts per +1.0 metric gain</span></li>
                    <li className="flex justify-between"><span className="text-cyan-400">Stability Bonus:</span> <span>+20 pts if all metrics ≥ 4.0</span></li>
                    <li className="flex justify-between"><span className="text-red-400">Loss Penalty:</span> <span>-5 pts per -1.0 metric loss</span></li>
                    <li className="flex justify-between border-t border-slate-700 pt-1 mt-1"><span className="text-amber-400">Bank Loan:</span> <span>-10 pts penalty</span></li>
                    <li className="flex justify-between"><span className="text-indigo-400">Final Bailout:</span> <span>Score cut by 50%</span></li>
                 </ul>
              </div>
           </div>
           
           <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-700/30 mb-8">
               <h3 className="text-lg font-bold text-white mb-4 text-center">Select Difficulty</h3>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => startGame(d)}
                      className="group relative overflow-hidden p-4 rounded-xl bg-slate-800 border border-slate-600 hover:border-cyan-500 transition-all hover:shadow-lg hover:shadow-cyan-900/20"
                    >
                       <div className="relative z-10">
                          <span className="block text-xl font-bold text-white mb-1">{d}</span>
                          <span className="block text-xs text-slate-400 mb-2">{DIFFICULTY_SETTINGS[d].rounds} Rounds</span>
                          <div className="flex items-center gap-2 text-xs font-mono bg-slate-900 rounded px-2 py-1 w-fit">
                             <Clock size={12} /> {DIFFICULTY_SETTINGS[d].timeLimit}s
                          </div>
                       </div>
                       <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                  ))}
               </div>
           </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto animate-fade-in">
          
          {/* Game Over or Victory Screen */}
          {(gameState.status === 'GAME_OVER' || gameState.status === 'VICTORY') && (
            <GameOver 
              gameState={gameState} 
              onRestart={() => setShowIntro(true)} 
              onFinalBailout={handleFinalBailout}
              bailoutUnlocked={bailoutUnlocked}
            />
          )}

          {/* Active Gameplay */}
          {gameState.status === 'PLAYING' && (
            <>
              <Dashboard gameState={gameState} onTakeLoan={handleTakeLoan} />
              {gameState.currentScenario && (
                <ScenarioView 
                  scenario={gameState.currentScenario}
                  onChoose={handleChoice}
                  timeLimit={gameState.timeLimit}
                  onTimeout={handleTimeout}
                  loading={gameState.loading}
                />
              )}
            </>
          )}
          
          {/* Round Feedback/Pause Screen */}
          {gameState.status === 'ROUND_FEEDBACK' && gameState.lastRoundFeedback && (
            <>
                <Dashboard gameState={gameState} onTakeLoan={() => {}} />
                <RoundFeedbackView 
                    data={gameState.lastRoundFeedback} 
                    onNext={handleNextRound}
                />
            </>
          )}

        </div>
      )}

      {/* Toast Notifications */}
      {feedbackToast && (
        <div className="fixed bottom-8 right-8 bg-slate-800 border border-slate-600 shadow-2xl rounded-xl p-4 z-50 animate-slide-up max-w-sm">
           <h4 className="font-bold text-white mb-2 flex items-center gap-2">
              <Zap className="text-amber-400 w-4 h-4" /> {feedbackToast.title}
           </h4>
           <ul className="space-y-1">
              {feedbackToast.items.map((item, i) => (
                  <li key={i} className="text-xs text-slate-300 font-mono">{item}</li>
              ))}
           </ul>
        </div>
      )}
    </div>
  );
};

export default App;