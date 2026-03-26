import React, { useEffect } from 'react';
import { useSystemStore } from '../state/systemStore';
import { Database } from 'lucide-react';

export const Routing = () => {
  const { setStage } = useSystemStore();

  useEffect(() => {
    const timer = setTimeout(() => setStage('DELIVERY'), 2500);
    return () => clearTimeout(timer);
  }, [setStage]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary animate-spin">
          <Database size={32} />
        </div>
        <h2 className="text-3xl font-bold text-heading">Determining Destination</h2>
        <p className="text-body max-w-md">
          Analyzing Verified Opportunity artifact to determine the optimal delivery environment.
        </p>
      </div>
    </div>
  );
};
