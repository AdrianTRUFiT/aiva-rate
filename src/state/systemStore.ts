import { create } from 'zustand';
import { SystemStage, Artifact } from '../types';
import { SoulmarksService } from '../services/SoulmarksService';

const soulmarks = SoulmarksService.getInstance('adriantrufit@gmail.com');

interface SystemState {
  currentStage: SystemStage;
  artifacts: Partial<Record<SystemStage, Artifact>>;
  setStage: (stage: SystemStage) => void;
  emitArtifact: (stage: SystemStage, artifact: Artifact) => void;
  reset: () => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  currentStage: 'ENTRY',
  artifacts: {},
  setStage: (stage) => set({ currentStage: stage }),
  emitArtifact: (stage, artifact) => 
    set((state) => {
      // Automatically generate soulmark for verification
      const soulmark = soulmarks.generateSoulmark(stage, artifact);
      const verifiedArtifact = { ...artifact, soulmark };
      
      return { 
        artifacts: { ...state.artifacts, [stage]: verifiedArtifact } 
      };
    }),
  reset: () => set({ currentStage: 'ENTRY', artifacts: {} }),
}));
