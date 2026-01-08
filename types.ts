
export interface PhonicData {
  letter: string;
  word: string;
  phonic: string;
  image: string;
  color: string;
}

export enum AppState {
  LEARNING = 'LEARNING',
  PRACTICING = 'PRACTICING'
}
