import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Sparkles, 
  Headphones,
  Info,
  AlertCircle
} from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';

const LiveAITutor: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcription]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    setTranscription([]);

    try {
      const systemInstruction = `You are a friendly and encouraging AI English Tutor. 
      Your goal is to have a natural voice conversation with the student.
      - Speak clearly and at a moderate pace.
      - If the student makes a mistake, gently correct them.
      - Ask open-ended questions to keep the conversation flowing.
      - Focus on topics like daily life, hobbies, and school.
      - Keep your responses relatively short to encourage the student to speak more.`;

      liveServiceRef.current = new GeminiLiveService();
      await liveServiceRef.current.connect(systemInstruction, {
        onOpen: () => {
          setIsConnected(true);
          setIsConnecting(false);
        },
        onClose: () => {
          setIsConnected(false);
          setIsConnecting(false);
        },
        onTranscription: (text, isModel) => {
          setTranscription(prev => [...prev, { text, isModel }]);
        },
        onError: (err) => {
          console.error(err);
          setError("Connection failed. Please check your microphone and try again.");
          setIsConnecting(false);
        }
      });
    } catch (err) {
      console.error(err);
      setError("Failed to initialize the Live AI Tutor.");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.disconnect();
    }
    setIsConnected(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Headphones className="w-7 h-7 text-white" />
            </div>
            Live AI Tutor
          </h1>
          <p className="text-zinc-500 font-bold mt-1">Real-time voice conversation for natural English practice</p>
        </div>
      </div>

      <div className="bg-[#1a1635] border border-white/5 rounded-[2.5rem] p-12 shadow-2xl flex flex-col items-center text-center space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32" />
        
        {!isConnected ? (
          <div className="space-y-8 relative z-10">
            <div className="w-32 h-32 bg-emerald-500/10 rounded-[40px] flex items-center justify-center mx-auto border border-emerald-500/20 group hover:scale-105 transition-transform duration-500">
              <Sparkles className="w-16 h-16 text-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">Ready to Practice?</h2>
              <p className="text-zinc-400 max-w-sm mx-auto font-medium leading-relaxed">
                Start a live voice conversation with your AI tutor. Practice speaking, get corrections, and build confidence in real-time.
              </p>
            </div>
            <button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-12 py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-3xl transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 mx-auto disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  Start Conversation
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-8 relative z-10">
            {/* Visualizer Placeholder */}
            <div className="flex items-center justify-center gap-1 h-32">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: [20, 60, 30, 80, 40],
                    backgroundColor: ['#10b981', '#34d399', '#10b981']
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1 + Math.random(),
                    ease: "easeInOut"
                  }}
                  className="w-2 rounded-full bg-emerald-500"
                />
              ))}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">AI Tutor is Listening...</h2>
              <p className="text-emerald-400 text-xs font-black uppercase tracking-widest animate-pulse">Live Session Active</p>
            </div>

            <div className="bg-black/20 border border-white/5 rounded-3xl p-6 h-64 overflow-y-auto custom-scrollbar text-left space-y-4" ref={scrollRef}>
              {transcription.length === 0 && (
                <p className="text-zinc-600 italic text-center py-20">Start speaking to see transcription...</p>
              )}
              {transcription.map((t, i) => (
                <div key={i} className={`flex gap-3 ${t.isModel ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  <span className="font-black text-[10px] uppercase tracking-widest mt-1">
                    {t.isModel ? 'Tutor:' : 'You:'}
                  </span>
                  <p className="text-sm font-medium leading-relaxed">{t.text}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-5 rounded-3xl transition-all border ${isMuted ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              <button 
                onClick={handleDisconnect}
                className="px-8 py-5 bg-red-500 hover:bg-red-400 text-white font-black rounded-3xl transition-all shadow-xl shadow-red-500/20"
              >
                End Session
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] p-8 flex items-start gap-6">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Info className="w-6 h-6 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest">How it works</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium">
            The Live AI Tutor uses advanced real-time voice technology. It hears you and responds instantly, just like a real person. 
            For the best experience, use headphones and practice in a quiet environment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveAITutor;
