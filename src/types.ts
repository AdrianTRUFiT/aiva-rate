export type SystemStage = 
  | 'ENTRY' 
  | 'ACQUISITION' 
  | 'STABILIZATION' 
  | 'QUALIFICATION' 
  | 'ROUTING' 
  | 'TRANSACTION' 
  | 'DELIVERY';

export interface Soulmark {
  signature: string;
  authorship: string;
  stage: SystemStage;
  artifactHash: string;
  timestamp: string;
}

export interface Artifact {
  id: string;
  timestamp: string;
  type: string;
  data: any;
  authorship?: string;
  soulmark?: Soulmark;
}

export interface AIOPNode {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'boolean';
  options?: string[];
  next?: (answer: any) => string | null;
}

export interface AIOPState {
  currentNodeId: string;
  answers: Record<string, any>;
  isComplete: boolean;
  qualificationScore: number;
}

export interface CapturedSignal extends Artifact {
  type: 'CAPTURED_SIGNAL';
  data: {
    rawInput: string;
    intent: string;
    context: Record<string, any>;
  };
}

export interface VerifiedOpportunity extends Artifact {
  type: 'VERIFIED_OPPORTUNITY';
  data: {
    qualificationScore: number;
    branchingLogic: string;
    userState: string;
    requirements: string[];
  };
}

export interface ActivatedTransactionState extends Artifact {
  type: 'ACTIVATED_TRANSACTION_STATE';
  data: {
    commitmentVerified: boolean;
    transactionId: string;
    termsAccepted: boolean;
  };
}

export interface LiveSystemRecord extends Artifact {
  type: 'LIVE_SYSTEM_RECORD';
  data: {
    environmentId: string;
    persistedData: any;
    status: 'ACTIVE' | 'ARCHIVED';
  };
}
