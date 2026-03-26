import React from 'react';
import { useSystemStore } from '../state/systemStore';
import { ShieldCheck } from 'lucide-react';

export const Stabilization = () => {
  const { setStage } = useSystemStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="max-w-2xl space-y-8">
        <div className="space-y-4 text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>AI Virtual Agency</span>
          </div>
          <h2 className="text-3xl font-bold text-heading">Stabilizing Context</h2>
          <p className="text-body text-lg">
            We have captured your signal. Before qualification begins, we must frame the operational environment 
            to ensure maximum alignment with system logic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-3">
            <h3 className="font-bold text-heading">Governed Logic</h3>
            <p className="text-sm text-body">
              Every decision within this framework is artifact-based and verifiable. 
              Trust is established through system transparency.
            </p>
          </div>
          <div className="card p-6 space-y-3">
            <h3 className="font-bold text-heading">Adaptive Flow</h3>
            <p className="text-sm text-body">
              The next stage will adapt dynamically to your inputs. 
              There are no static forms, only live processing.
            </p>
          </div>
        </div>

        <button 
          onClick={() => setStage('QUALIFICATION')}
          className="w-full btn-primary"
        >
          Initialize Adaptive Qualification
        </button>
      </div>
    </div>
  );
};
