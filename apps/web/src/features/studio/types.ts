export interface ClipItem {
  id: string;
  title: string;
  duration: string;
  viralScore: string;
  rank: number;
  highlightMoment: string;
  preset: string;
  imageSrc: string;
  renderStatus?: string;
  progress?: number;
  bottomScoreText: string;
  bottomPresetText: string;
}

export type ProcessingStatus = 'idle' | 'downloading' | 'analyzing' | 'completed' | 'error';
