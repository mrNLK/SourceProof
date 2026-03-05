export interface CodeQualityDimensions {
  aiMastery: number;
  buildVelocity: number;
  tooling: number;
  testing: number;
  documentation: number;
  communityHealth: number;
}

export interface RepoQuality {
  name: string;
  score: number;
  signals: string[];
  concerns: string[];
}

export interface CommitQuality {
  total: number;
  withGoodMessages: number;
  averageMessageLength: number;
  claudeCodeCommits: number;
  aiAssistedCommits: number;
}

export interface CodeQualityReport {
  username: string;
  overallScore: number;
  dimensions: CodeQualityDimensions;
  repoBreakdown: RepoQuality[];
  commitQuality: CommitQuality;
  summary: string;
  strengths: string[];
  improvements: string[];
  aiSignals: AiSignals;
}

export interface AiSignals {
  genaiRepoCount: number;
  aiFrameworksDetected: string[];
  claudeCodeUsage: boolean;
  aiCodingTools: string[];
  recentAiActivity: boolean;
}
