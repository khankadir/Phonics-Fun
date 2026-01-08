
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { PHONICS_DATA } from './constants';
import { PhonicData } from './types';
import LetterCard from './components/LetterCard';
import SparkyMascot from './components/SparkyMascot';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';

const App: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPracticing, setIsPracticing] = useState(false);
  const [message, setMessage] = useState("Hi! I'm Sparky. Let's learn sounds together!");
  const [isListening, setIsListening] = useState(false);

  const currentData = PHONICS_DATA[currentIndex];

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const cleanupAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const ensureApiKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (!hasKey) {
          await aiStudio.openSelectKey();
          // Per instructions: assume success after triggering openSelectKey
        }
      } catch (e) {
        console.error("API Key selection handling failed:", e);
      }
    }
  };

  const handleHearSound = async () => {
    await ensureApiKey();

    try {
      // Create fresh instance before each call as required
      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      const promptText = `The child is learning the letter ${currentData.letter}. Say the phonic sound for ${currentData.letter} clearly. For example, '${currentData.phonic}'. Then say the word '${currentData.word}'. Keep it short and sweet for a toddler.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
        setMessage(`Listen carefully to the sound of ${currentData.letter}!`);
      } else {
        throw new Error("No audio data found in response");
      }
    } catch (error: any) {
      console.error("TTS Error details:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setMessage("I couldn't find my voice model. Please try selecting your API key again!");
        const aiStudio = (window as any).aistudio;
        if (aiStudio) await aiStudio.openSelectKey();
      } else {
        setMessage("Oh no! Sparky's voice is missing. Let's try again!");
      }
    }
  };

  const startPractice = async () => {
    await ensureApiKey();

    try {
      setIsPracticing(true);
      setIsListening(true);
      setMessage(`Sparky is listening! Say '${currentData.phonic}' like in '${currentData.word}'...`);

      const ai = new GoogleGenAI({ apiKey: (process.env as any).API_KEY });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              // Use sessionPromise directly to avoid race conditions
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
              const source = outputAudioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContextRef.current.destination);
              source.addEventListener('ended', () => activeSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              activeSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live Error:", e);
            stopPractice();
          },
          onclose: () => stopPractice(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are Sparky, a friendly preschool teacher dog. A child is learning phonics. 
          The current letter is '${currentData.letter}' which makes the sound '${currentData.phonic}'. 
          Listen to the child and give very enthusiastic, simple feedback. 
          If they are close, cheer! If they are quiet, encourage them. 
          Use simple words like 'Yay!', 'Great job!', 'Try again buddy!'. 
          Keep responses under 5-8 words.`,
        },
      });

      sessionRef.current = await sessionPromise;

    } catch (err) {
      console.error("Session failed:", err);
      stopPractice();
      setMessage("Oops! My ears are sleepy. Please check your mic!");
    }
  };

  const stopPractice = () => {
    setIsPracticing(false);
    setIsListening(false);
    setMessage("Good job! You did great! Want to try another letter?");
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    cleanupAudio();
  };

  const nextLetter = () => {
    if (isPracticing) stopPractice();
    setCurrentIndex((prev) => (prev + 1) % PHONICS_DATA.length);
  };

  const prevLetter = () => {
    if (isPracticing) stopPractice();
    setCurrentIndex((prev) => (prev - 1 + PHONICS_DATA.length) % PHONICS_DATA.length);
  };

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  return (
    <div className="min-h-screen pb-24 flex flex-col items-center">
      <header className="w-full bg-white shadow-sm p-4 flex justify-between items-center mb-8">
        <h1 className="text-3xl font-kids text-blue-600 tracking-tight">
          Phonics <span className="text-pink-500">Fun</span>
        </h1>
        <div className="flex gap-2">
          {['🌈', '⭐', '🎈'].map((emoji, i) => (
            <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>
              {emoji}
            </span>
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 max-w-4xl">
        <div className="relative w-full">
          <button
            onClick={prevLetter}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 bg-white p-4 rounded-full shadow-lg text-3xl z-10 hover:bg-yellow-100 transition-colors"
          >
            ⬅️
          </button>
          
          <LetterCard
            data={currentData}
            onHearSound={handleHearSound}
            onPractice={isPracticing ? stopPractice : startPractice}
            isPracticing={isPracticing}
          />

          <button
            onClick={nextLetter}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 bg-white p-4 rounded-full shadow-lg text-3xl z-10 hover:bg-yellow-100 transition-colors"
          >
            ➡️
          </button>
        </div>

        <SparkyMascot message={message} isListening={isListening} />
      </main>

      <div className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md p-4 flex gap-3 overflow-x-auto shadow-[0_-4px_10px_rgba(0,0,0,0.05)] scrollbar-hide z-50">
        {PHONICS_DATA.map((item, idx) => (
          <button
            key={item.letter}
            onClick={() => {
              if (isPracticing) stopPractice();
              setCurrentIndex(idx);
            }}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl font-kids transition-all ${
              currentIndex === idx
                ? 'bg-blue-500 text-white scale-110 shadow-md ring-4 ring-blue-200'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {item.letter}
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
