
import React from 'react';
import { PhonicData } from '../types';

interface LetterCardProps {
  data: PhonicData;
  onHearSound: () => void;
  onPractice: () => void;
  isPracticing: boolean;
}

const LetterCard: React.FC<LetterCardProps> = ({ data, onHearSound, onPractice, isPracticing }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl shadow-xl border-8 border-yellow-200 w-full max-w-md mx-auto transition-all transform hover:scale-105">
      <div className={`w-32 h-32 ${data.color} rounded-full flex items-center justify-center text-white text-7xl font-kids shadow-lg mb-6 animate-float`}>
        {data.letter}
      </div>
      
      <div className="text-4xl mb-2 flex items-center gap-4">
        <span className="text-gray-700 font-bold uppercase">{data.letter}</span>
        <span className="text-gray-400">is for</span>
        <span className="font-kids text-red-500">{data.word}</span>
      </div>
      
      <div className="text-8xl mb-8 filter drop-shadow-md">
        {data.image}
      </div>

      <div className="flex flex-col w-full gap-4">
        <button
          onClick={onHearSound}
          disabled={isPracticing}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-2xl text-2xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <span>🔊</span> Hear Sound
        </button>
        
        <button
          onClick={onPractice}
          className={`${
            isPracticing ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-green-500 hover:bg-green-600'
          } text-white font-bold py-4 px-8 rounded-2xl text-2xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-3`}
        >
          <span>{isPracticing ? '🛑' : '🎤'}</span> {isPracticing ? 'Stop Practice' : 'Practice Now!'}
        </button>
      </div>
    </div>
  );
};

export default LetterCard;
