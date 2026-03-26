import { AIOPNode, AIOPState } from '../types';

export class AIOPEngine {
  private nodes: Record<string, AIOPNode>;
  private initialState: AIOPState;

  constructor(nodes: AIOPNode[], firstNodeId: string) {
    this.nodes = nodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {});
    this.initialState = {
      currentNodeId: firstNodeId,
      answers: {},
      isComplete: false,
      qualificationScore: 0,
    };
  }

  processAnswer(state: AIOPState, answer: any): AIOPState {
    const currentNode = this.nodes[state.currentNodeId];
    if (!currentNode) return state;

    const nextAnswers = { ...state.answers, [state.currentNodeId]: answer };
    const nextNodeId = currentNode.next ? currentNode.next(answer) : null;

    if (!nextNodeId) {
      return {
        ...state,
        answers: nextAnswers,
        isComplete: true,
        qualificationScore: this.calculateScore(nextAnswers),
      };
    }

    return {
      ...state,
      currentNodeId: nextNodeId,
      answers: nextAnswers,
    };
  }

  private calculateScore(answers: Record<string, any>): number {
    // Domain-agnostic scoring logic
    // For now, simple count of non-empty answers
    const total = Object.keys(answers).length;
    const answered = Object.values(answers).filter(v => !!v).length;
    return Math.round((answered / total) * 100);
  }

  getCurrentNode(state: AIOPState): AIOPNode {
    return this.nodes[state.currentNodeId];
  }

  getInitialState(): AIOPState {
    return this.initialState;
  }
}

// Example domain-agnostic nodes
export const defaultAIOPNodes: AIOPNode[] = [
  {
    id: 'impact',
    question: 'What is the primary metric currently being impacted?',
    type: 'text',
    next: () => 'bottleneck'
  },
  {
    id: 'bottleneck',
    question: 'Identify the core bottleneck in your current workflow.',
    type: 'text',
    next: (ans) => ans.length > 50 ? 'complexity' : 'timeline'
  },
  {
    id: 'complexity',
    question: 'The described bottleneck indicates high complexity. Is this a multi-departmental issue?',
    type: 'boolean',
    next: () => 'timeline'
  },
  {
    id: 'timeline',
    question: 'What is the desired state of the system after 90 days?',
    type: 'text',
    next: () => null // End of flow
  }
];
