import React, { useState, useMemo } from 'react';
import { useSystemStore } from '../state/systemStore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AIOPEngine, defaultAIOPNodes } from './AIOPEngine';
import { AIOPState, VerifiedOpportunity } from '../types';
import { Check, ChevronRight } from 'lucide-react';

export const Qualification = () => {
  const engine = useMemo(() => new AIOPEngine(defaultAIOPNodes, 'impact'), []);
  const [state, setState] = useState<AIOPState>(engine.getInitialState());
  const { setStage, emitArtifact } = useSystemStore();
  const [inputValue, setInputValue] = useState('');

  const currentNode = engine.getCurrentNode(state);

  const handleNext = (answer: any) => {
    const nextState = engine.processAnswer(state, answer);
    setState(nextState);
    setInputValue('');
    
    if (nextState.isComplete) {
      const artifact: VerifiedOpportunity = {
        id: `opp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'VERIFIED_OPPORTUNITY',
        data: {
          qualificationScore: nextState.qualificationScore,
          branchingLogic: 'AIOP_DYNAMIC_BRANCHING',
          userState: 'QUALIFIED',
          requirements: Object.values(nextState.answers)
        }
      };
      emitArtifact('QUALIFICATION', artifact);
      setStage('ROUTING');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="w-full max-w-2xl card p-8 space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-primary uppercase tracking-widest">AIOP Engine</span>
            <span className="text-xs text-muted">Adaptive Qualification Experience</span>
          </div>
          <div className="flex space-x-1">
            {defaultAIOPNodes.map((node, i) => (
              <div 
                key={node.id} 
                className={cn(
                  "w-8 h-1 rounded-full transition-colors", 
                  state.answers[node.id] ? "bg-primary" : (node.id === state.currentNodeId ? "bg-primary/40" : "bg-surface-muted")
                )} 
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={state.currentNodeId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-heading">{currentNode.question}</h2>
            
            <div className="space-y-4">
              {currentNode.type === 'text' && (
                <textarea 
                  className="input-field min-h-[120px]"
                  placeholder="Provide structured response..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
                      e.preventDefault();
                      handleNext(inputValue);
                    }
                  }}
                />
              )}

              {currentNode.type === 'boolean' && (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleNext(true)}
                    className="btn-secondary py-6 flex flex-col items-center space-y-2"
                  >
                    <Check size={24} className="text-primary" />
                    <span>Affirmative</span>
                  </button>
                  <button 
                    onClick={() => handleNext(false)}
                    className="btn-secondary py-6 flex flex-col items-center space-y-2"
                  >
                    <div className="w-6 h-6 rounded-full border-2 border-muted" />
                    <span>Negative</span>
                  </button>
                </div>
              )}

              {currentNode.type === 'text' && (
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted">Press Enter or click proceed to pass signal forward</p>
                  <button 
                    onClick={() => handleNext(inputValue)}
                    disabled={!inputValue.trim()}
                    className="btn-primary flex items-center space-x-2 disabled:opacity-50"
                  >
                    <span>Proceed</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
