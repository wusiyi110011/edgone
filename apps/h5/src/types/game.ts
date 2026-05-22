export type HotspotId = 'shortTubePort' | 'connectorPort' | 'longTubePort';

export type ConnectionAnswer = {
  firstPortId: HotspotId | null;
  secondPortId: HotspotId | null;
  patientPortId: HotspotId | null;
};

export type SubmittedConnectionAnswer = {
  firstPortId: HotspotId;
  secondPortId: HotspotId;
  patientPortId: HotspotId;
};

export type EvaluationDetail = {
  selectedPortIds: HotspotId[];
  correctPortIds: HotspotId[];
  selectedPatientPortId: HotspotId;
  correctPatientPortId: HotspotId;
  pairIsCorrect: boolean;
  patientTubeIsCorrect: boolean;
  isCorrect: boolean;
};

export type GameResult = {
  sessionId: string;
  playerName: string;
  source: string;
  submittedAt: string;
  startedAt: string;
  answer: SubmittedConnectionAnswer;
  score: number;
  total: number;
  isCorrect: boolean;
  details: EvaluationDetail[];
};

export type GameStats = {
  correctCount: number;
  incorrectCount: number;
  totalSubmissions: number;
  accuracy: number;
  recentAttempts: Array<{
    playerName: string;
    submittedAt: string;
    score: number;
    total: number;
    isCorrect: boolean;
  }>;
};
