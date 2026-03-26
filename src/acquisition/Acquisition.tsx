import React, { useEffect } from 'react';
import { useSystemStore } from '../state/systemStore';
import { CapturedSignal } from '../types';
import { Zap } from 'lucide-react';
import { motion } from 'motion/react';

export const Acquisition = () => {
  const { setStage, artifacts } = useSystemStore();
  const signal = artifacts.ENTRY as CapturedSignal;

  useEffect(() => {
    const timer = setTimeout(() => setStage('STABILIZATION'), 2000);
    return () => clearTimeout(timer);
  }, [setStage]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="card p-12 flex flex-col items-center space-y-6 max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
          <Zap size={32} />
        </div>
        <h2 className="text-2xl font-bold text-heading">Structuring Signal...</h2>
        <p className="text-body">
          DICE-compatible processing in progress. Converting raw input into a governed system artifact.
        </p>
        <div className="w-full bg-surface-muted h-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2 }}
            className="bg-primary h-full"
          />
        </div>
        <div className="text-xs font-mono text-muted break-all">
          ID: {signal?.id}
        </div>
      </div>
    </div>
  );
};
