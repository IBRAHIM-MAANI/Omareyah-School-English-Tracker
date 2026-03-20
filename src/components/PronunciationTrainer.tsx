import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, MicOff, Volume2, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { PRONUNCIATION_TRAINER_PROMPT } from '../constants';

interface PronunciationTrainerProps {
  missedWords: string[];
  onClose: () => void;
}

const PronunciationTrainer: React.FC<PronunciationTrainerProps> = ({ missedWords, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean }[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const geminiLive = useRef(new GeminiLiveService());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcription]);

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const prompt = PRONUNCIATION_TRAINER_PROMPT.replace('{MISSED_WORDS}', missedWords.join(', '));
      await geminiLive.current.connect(prompt, {
        onOpen: () => {
          setIsActive(true);
          setIsConnecting(false);
        },
        onClose: () => {
          setIsActive(false);
          setIsConnecting(false);
        },
        onTranscription: (text, isModel) => {
          setTranscription(prev => [...prev, { text, isModel }]);
        },
        onError: (err) => {
          console.error("Trainer error:", err);
          setIsConnecting(false);
        }
      });
    } catch (err) {
      console.error("Failed to start trainer:", err);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    geminiLive.current.disconnect();
    setIsActive(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Pronunciation Trainer</h3>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Live AI Coaching</p>
            </div>
          </div>
          <button 
            onClick={() => {
              stopSession();
              onClose();
            }}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={scrollRef}>
          {!isActive && !isConnecting ? (
            <div className="text-center space-y-6 py-12">
              <div className="space-y-2">
                <h4 className="text-xl font-bold">Ready to practice?</h4>
                <p className="text-zinc-400 text-sm max-w-md mx-auto">
                  We'll go through the words you missed: <span className="text-emerald-500 font-medium">{missedWords.join(', ')}</span>. 
                  The AI will guide you through each one.
                </p>
              </div>
              
              <button 
                onClick={startSession}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 px-8 rounded-2xl transition-all flex items-center gap-3 mx-auto shadow-lg shadow-emerald-500/20"
              >
                <Mic className="w-5 h-5" />
                Start Training Session
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {transcription.length === 0 && isConnecting && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <p className="text-zinc-500 animate-pulse">Connecting to AI Coach...</p>
                </div>
              )}
              
              {transcription.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: msg.isModel ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.isModel ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                    msg.isModel 
                      ? 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700' 
                      : 'bg-emerald-500 text-black font-medium rounded-tr-none'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {isActive && (
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                <div className="w-3 h-3 bg-emerald-500 rounded-full relative z-10"></div>
              </div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Live Session Active</span>
            </div>
            
            <button 
              onClick={stopSession}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2 text-sm"
            >
              <MicOff className="w-4 h-4" />
              End Session
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default PronunciationTrainer;
