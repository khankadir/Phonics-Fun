
import React from 'react';

interface SparkyMascotProps {
  message: string;
  isListening: boolean;
}

const SparkyMascot: React.FC<SparkyMascotProps> = ({ message, isListening }) => {
  return (
    <div className="flex flex-col items-center mt-8">
      <div className="relative mb-4">
        {/* Bubble */}
        <div className="bg-white p-4 rounded-2xl shadow-md border-4 border-blue-200 max-w-xs text-center relative">
          <p className="text-lg font-bold text-blue-800">{message}</p>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-white"></div>
        </div>
      </div>
      
      {/* Sparky */}
      <div className={`text-6xl ${isListening ? 'animate-bounce' : 'animate-float'}`}>
        🐕
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Sparky the Teacher</p>
    </div>
  );
};

export default SparkyMascot;
