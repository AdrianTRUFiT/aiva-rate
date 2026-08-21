import type { Artifact, Soulmark } from '../types';

/**
 * Signs and verifies session artifacts.
 *
 * This is a tamper-evidence marker for a local audit trail, not cryptography:
 * the hash is a 32-bit rolling hash and the signature is base64 of a plaintext
 * tuple. It detects accidental drift between an artifact and its record. It
 * would not survive anyone who wanted to forge one, and nothing security-
 * relevant should be built on it without replacing both primitives.
 */
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

  public generateSoulmark(stage: string, artifact: Artifact): Soulmark {
    const artifactHash = this.hashArtifact(artifact);
    const timestamp = new Date().toISOString();
    const signature = this.sign(artifactHash, timestamp, stage);

    return { signature, authorship: this.authorship, stage, artifactHash, timestamp };
  }

  private hashArtifact(artifact: Artifact): string {
    const dataStr = JSON.stringify(artifact.data);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      hash = (hash << 5) - hash + dataStr.charCodeAt(i);
      hash |= 0;
    }
    return `h32_${Math.abs(hash).toString(16)}`;
  }

  private sign(hash: string, timestamp: string, stage: string): string {
    return `sig_${btoa(`${this.authorship}:${hash}:${timestamp}:${stage}`).substring(0, 32)}`;
  }

  public verifySoulmark(soulmark: Soulmark, artifact: Artifact): boolean {
    return soulmark.artifactHash === this.hashArtifact(artifact);
  }
}
