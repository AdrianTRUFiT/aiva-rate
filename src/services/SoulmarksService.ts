import { Soulmark, SystemStage, Artifact } from '../types';

export class SoulmarksService {
  private static instance: SoulmarksService;
  private authorship: string;

  private constructor(authorship: string) {
    this.authorship = authorship;
  }

  public static getInstance(authorship: string): SoulmarksService {
    if (!SoulmarksService.instance) {
      SoulmarksService.instance = new SoulmarksService(authorship);
    }
    return SoulmarksService.instance;
  }

  public generateSoulmark(stage: SystemStage, artifact: Artifact): Soulmark {
    const artifactHash = this.hashArtifact(artifact);
    const timestamp = new Date().toISOString();
    const signature = this.sign(artifactHash, timestamp, stage);

    return {
      signature,
      authorship: this.authorship,
      stage,
      artifactHash,
      timestamp,
    };
  }

  private hashArtifact(artifact: Artifact): string {
    // Simple mock hash for demonstration
    const dataStr = JSON.stringify(artifact.data);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return `sha256_${Math.abs(hash).toString(16)}`;
  }

  private sign(hash: string, timestamp: string, stage: SystemStage): string {
    // Mock signature logic
    return `sig_${btoa(`${this.authorship}:${hash}:${timestamp}:${stage}`).substring(0, 32)}`;
  }

  public verifySoulmark(soulmark: Soulmark, artifact: Artifact): boolean {
    const currentHash = this.hashArtifact(artifact);
    return soulmark.artifactHash === currentHash;
  }
}
