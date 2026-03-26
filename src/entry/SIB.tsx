import React, { useState } from 'react';
import { useSystemStore } from '../state/systemStore';
import { CapturedSignal } from '../types';
import { ArrowRight, Activity } from 'lucide-react';

export const SIB = () => {
  const [input, setInput] = useState('');
  const { setStage, emitArtifact } = useSystemStore();

  const handleCapture = () => {
    if (!input.trim()) return;
    
    const artifact: CapturedSignal = {
      id: `sig_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'CAPTURED_SIGNAL',
      data: {
        rawInput: input,
        intent: 'INITIAL_CONTACT',
        context: { source: 'SIB_DIRECT' }
      }
    };

    emitArtifact('ENTRY', artifact);
    setStage('ACQUISITION');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="text-center space-y-4 max-w-2xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
          <Activity size={14} />
          <span>Signal Integrity Boundary</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-heading">
          Initialize System Signal
        </h1>
        <p className="text-body text-lg">
          The system requires immediate structured input to begin processing. 
          No passive navigation is permitted beyond this boundary.
        </p>
      </div>

      <div className="w-full max-w-xl card p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-heading font-semibold text-sm">Primary Signal Input</label>
          <textarea
            className="input-field min-h-[120px] resize-none"
            placeholder="Describe your operational bottleneck or system requirement..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button 
          onClick={handleCapture}
          disabled={!input.trim()}
          className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Capture Signal</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
