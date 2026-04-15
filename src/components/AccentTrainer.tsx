import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Mic, 
  MicOff, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Volume2,
  RefreshCw,
  ChevronRight,
  Info
} from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';

interface AccentOption {
  id: string;
  name: string;
  flag: string;
  description: string;
  prompt: string;
}

const ACCENTS: AccentOption[] = [
  {
    id: 'rp',
    name: 'British (RP)',
    flag: '🇬🇧',
    description: 'Received Pronunciation - standard British accent.',
    prompt: 'You are a British RP accent coach. Focus on vowel clarity and non-rhoticity.'
  },
  {
    id: 'ga',
    name: 'American (GA)',
    flag: '🇺🇸',
    description: 'General American - standard US accent.',
    prompt: 'You are an American accent coach. Focus on rhotic "r" and "t" flapping.'
  },
  {
    id: 'au',
    name: 'Australian',
    flag: '🇦🇺',
    description: 'Standard Australian English accent.',
    prompt: 'You are an Australian accent coach. Focus on rising intonation and diphthongs.'
  }
];

const AccentTrainer: React.FC = () => {
  const [selectedAccent, setSelectedAccent] = useState<AccentOption>(ACCENTS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [practiceText, setPracticeText] = useState("The water in Majorca don't taste like what it oughta.");
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  const startPractice = async () => {
    setIsRecording(true);
    setFeedback(null);
    setIsAnalyzing(false);

    try {
      const prompt = `${selectedAccent.prompt}
      The student will read the following text: "${practiceText}"
      Listen carefully to their pronunciation, intonation, and rhythm.
      Provide specific feedback on how to sound more like a native ${selectedAccent.name} speaker.
      Be encouraging and provide 2-3 actionable tips.`;

      const callbacks = {
        onTranscription: (text, isModel) => {
          if (isModel) {
            setFeedback(prev => (prev || '') + text);
          }
        },
        onClose: () => {
          setIsRecording(false);
          setIsAnalyzing(false);
        },
        onError: () => {
          setIsRecording(false);
          setIsAnalyzing(false);
        }
      };

      liveServiceRef.current = new GeminiLiveService();
      await liveServiceRef.current.connect(prompt, callbacks);
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  const stopPractice = async () => {
    setIsRecording(false);
    setIsAnalyzing(true);
    if (liveServiceRef.current) {
      await liveServiceRef.current.stopAudioCapture();
      // Keep connection open for a bit to receive feedback
      setTimeout(() => {
        if (liveServiceRef.current) liveServiceRef.current.disconnect();
        setIsAnalyzing(false);
      }, 5000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Globe className="w-7 h-7 text-white" />
            </div>
            Accent Trainer
          </h1>
          <p className="text-zinc-500 font-bold mt-1">Master specific English accents with real-time AI feedback</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Accent Selection */}
        <div className="space-y-4">
          <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest px-2">Select Accent</h2>
          <div className="space-y-3">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                onClick={() => setSelectedAccent(accent)}
                className={`w-full p-5 rounded-3xl border transition-all text-left flex items-center gap-4 group ${
                  selectedAccent.id === accent.id 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-white' 
                    : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
                }`}
              >
                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{accent.flag}</span>
                <div>
                  <p className="font-black">{accent.name}</p>
                  <p className="text-xs opacity-60 font-bold">{accent.description}</p>
                </div>
                {selectedAccent.id === accent.id && <CheckCircle2 className="w-5 h-5 ml-auto text-emerald-400" />}
              </button>
            ))}
          </div>

          <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <Info className="w-5 h-5" />
              <span className="font-black text-sm uppercase tracking-wider">Pro Tip</span>
            </div>
            <p className="text-xs text-indigo-200/70 leading-relaxed font-medium">
              Try to mimic the rhythm and melody of the accent, not just the individual sounds. 
              Pay attention to which syllables are stressed!
            </p>
          </div>
        </div>

        {/* Middle & Right: Practice Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1a1635] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Sparkles className="w-32 h-32 text-emerald-400" />
            </div>

            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Practice Text</label>
                <textarea
                  value={practiceText}
                  onChange={(e) => setPracticeText(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-3xl p-6 text-xl font-bold text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all min-h-[120px] resize-none"
                  placeholder="Enter text to practice..."
                />
              </div>

              <div className="flex flex-col items-center justify-center py-10 space-y-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={isRecording ? stopPractice : startPractice}
                  className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all relative ${
                    isRecording 
                      ? 'bg-red-500 shadow-red-500/40' 
                      : 'bg-emerald-500 shadow-emerald-500/40'
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-white" />
                  )}
                  {isRecording && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-red-500"
                    />
                  )}
                </motion.button>
                <div className="text-center">
                  <p className="text-white font-black text-lg">
                    {isRecording ? 'Listening...' : isAnalyzing ? 'Analyzing...' : 'Click to Start'}
                  </p>
                  <p className="text-zinc-500 font-bold text-sm">
                    {isRecording ? 'Speak clearly into your mic' : 'Practice your chosen accent'}
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {(feedback || isAnalyzing) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="p-8 bg-white/5 border border-white/10 rounded-3xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Sparkles className="w-5 h-5" />
                        <span className="font-black uppercase tracking-wider">AI Feedback</span>
                      </div>
                      {isAnalyzing && <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />}
                    </div>
                    <div className="text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap">
                      {feedback || 'Analyzing your pronunciation patterns...'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/5 p-6 rounded-3xl flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                <Volume2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white font-black">Intonation</p>
                <p className="text-xs text-zinc-500 font-bold">Pitch & Rhythm</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 p-6 rounded-3xl flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white font-black">Accuracy</p>
                <p className="text-xs text-zinc-500 font-bold">Phonetic Precision</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccentTrainer;
