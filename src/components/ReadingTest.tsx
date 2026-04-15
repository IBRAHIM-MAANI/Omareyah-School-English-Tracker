import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { GeminiTTSService } from '../services/geminiTTSService';
import { READING_SPECIALIST_PROMPT, READING_PASSAGES } from '../constants';
import { auth, db, collection, setDoc, doc, Timestamp, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { getDocs, query, where } from 'firebase/firestore';

const ReadingTest: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedPassage, setSelectedPassage] = useState(READING_PASSAGES[0]);
  const [customPassage, setCustomPassage] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean }[]>([]);
  const [report, setReport] = useState<any | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const ttsServiceRef = useRef<GeminiTTSService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ttsServiceRef.current = new GeminiTTSService();
    return () => {
      ttsServiceRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'student'),
          where('teacherId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcription]);

  const startTest = async () => {
    if (!selectedStudentId) {
      setError("Please select a student first.");
      return;
    }
    setError(null);
    setIsConnecting(true);
    setTranscription([]);
    setReport(null);

    try {
      const passageText = customPassage || selectedPassage.text;
      const prompt = READING_SPECIALIST_PROMPT
        .replace('{PASSAGE_TEXT}', passageText);

      liveServiceRef.current = new GeminiLiveService();
      await liveServiceRef.current.connect(prompt, {
        onOpen: () => {
          setIsSessionActive(true);
          setIsConnecting(false);
          setStep(3);
        },
        onClose: () => {
          setIsSessionActive(false);
          setIsConnecting(false);
        },
        onTranscription: (text, isModel) => {
          setTranscription(prev => [...prev, { text, isModel }]);
          if (isModel && text.includes('[DATA_REPORT]')) {
            try {
              const jsonStr = text.split('[DATA_REPORT]')[1].split('[/DATA_REPORT]')[0];
              const data = JSON.parse(jsonStr);
              setReport(data);
              saveReport(data);
            } catch (err) {
              console.error("Failed to parse report:", err);
            }
          }
        },
        onError: (err) => {
          setError("Connection error. Please try again.");
          setIsConnecting(false);
          console.error(err);
        }
      });
    } catch (err) {
      setError("Failed to start session.");
      setIsConnecting(false);
      console.error(err);
    }
  };

  const stopTest = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.disconnect();
    }
    setIsSessionActive(false);
  };

  const handleListen = async () => {
    if (isSpeaking) {
      ttsServiceRef.current?.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const text = customPassage || selectedPassage.text;
    await ttsServiceRef.current?.speak(text);
    setIsSpeaking(false);
  };

  const saveReport = async (data: any) => {
    if (!auth.currentUser || !selectedStudentId) return;
    setIsGeneratingReport(true);
    try {
      let audioUrl = '';
      if (liveServiceRef.current) {
        const audioBlob = await liveServiceRef.current.getRecordedAudio();
        if (audioBlob) {
          const audioRef = ref(storage, `assessments/${auth.currentUser.uid}/${Date.now()}.webm`);
          const uploadResult = await uploadBytes(audioRef, audioBlob);
          audioUrl = await getDownloadURL(uploadResult.ref);
        }
      }

      const resultData = {
        studentId: selectedStudentId,
        teacherId: auth.currentUser.uid,
        type: 'reading',
        passageTitle: customPassage ? 'Custom Passage' : selectedPassage.title,
        passageText: customPassage || selectedPassage.text,
        overallLevel: data.cefr_level,
        scores: {
          accuracy: data.accuracy,
          fluency: data.fluency,
          intonation: data.intonation,
          vocabulary: data.vocabulary
        },
        strengths: "Good reading attempt.",
        weaknesses: data.missed_words?.join(', ') || "None identified.",
        improvementPlan: data.improvement_plan.split('\n').filter((s: string) => s.trim()),
        fullReport: JSON.stringify(data),
        audioUrl,
        createdAt: Timestamp.now()
      };

      await setDoc(doc(collection(db, 'academic_records')), resultData);
      setSuccess("Reading assessment saved successfully!");
      setStep(4);
    } catch (err) {
      console.error("Error saving report:", err);
      setError("Failed to save report.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-500" />
            Reading Aloud Test
          </h1>
          <p className="text-zinc-500 font-bold mt-1">AI evaluation of pronunciation, intonation, pace & clarity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Setup */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Select Student */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-[#1a1635] border border-white/5 rounded-[2rem] p-8 space-y-6 shadow-xl ${step > 1 ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">1</div>
              <h2 className="text-lg font-black text-white">Select Student</h2>
            </div>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              <option value="">Choose a student...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.level} ({s.age})</option>
              ))}
            </select>
            {selectedStudentId && (
              <button 
                onClick={() => setStep(2)}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                Next Step <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </motion.div>

          {/* Step 2: Choose Passage */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`bg-[#1a1635] border border-white/5 rounded-[2rem] p-8 space-y-6 shadow-xl ${step !== 2 ? (step < 2 ? 'opacity-30 grayscale pointer-events-none' : 'opacity-50 pointer-events-none') : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">2</div>
              <h2 className="text-lg font-black text-white">Enter Target Text</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {READING_PASSAGES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPassage(p);
                      setCustomPassage('');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      selectedPassage.id === p.id && !customPassage
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    {p.title}
                  </button>
                ))}
                <button
                  onClick={() => setCustomPassage(' ')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    customPassage ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                  }`}
                >
                  Custom
                </button>
              </div>

              <textarea
                value={customPassage || selectedPassage.text}
                onChange={(e) => setCustomPassage(e.target.value)}
                placeholder="Paste or type the passage the student will read aloud..."
                className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px] resize-none"
              />

              <div className="flex gap-4">
                <button 
                  onClick={handleListen}
                  className={`flex-1 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border ${
                    isSpeaking 
                      ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                  }`}
                >
                  {isSpeaking ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isSpeaking ? 'Stop Listening' : 'Listen to Passage'}
                </button>
                <button 
                  onClick={startTest}
                  disabled={isConnecting}
                  className="flex-[2] py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>Confirm Text → Start Recording</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Active Session */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {step === 3 ? (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1a1635] border border-white/5 rounded-[2rem] p-8 h-full flex flex-col min-h-[600px] shadow-2xl relative overflow-hidden"
              >
                {/* Recording Animation Background */}
                <div className="absolute inset-0 pointer-events-none opacity-10">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500 rounded-full blur-[120px] animate-pulse"></div>
                </div>

                <div className="relative z-10 flex flex-col h-full space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Recording Active</span>
                    </div>
                    <button 
                      onClick={stopTest}
                      className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all border border-red-500/20"
                    >
                      <Square className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 bg-black/20 rounded-3xl p-8 border border-white/5 overflow-y-auto custom-scrollbar space-y-6" ref={scrollRef}>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Target Text</h3>
                      <p className="text-2xl font-bold text-white leading-relaxed opacity-90 italic">
                        "{customPassage || selectedPassage.text}"
                      </p>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-4">
                      {transcription.map((msg, i) => (
                        <div key={i} className={`flex ${msg.isModel ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                            msg.isModel 
                              ? 'bg-white/5 text-zinc-300 border border-white/10' 
                              : 'bg-indigo-500 text-white font-bold'
                          }`}>
                            {msg.text.includes('[DATA_REPORT]') ? 'Generating Assessment Report...' : msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-zinc-500 text-sm font-medium">The AI is listening to your pronunciation and flow...</p>
                  </div>
                </div>
              </motion.div>
            ) : step === 4 ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-[#1a1635] border border-white/5 rounded-[2rem] p-8 shadow-2xl space-y-8"
              >
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h2 className="text-3xl font-black text-white">Assessment Complete!</h2>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">CEFR Level: {report?.cefr_level}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Accuracy', val: report?.accuracy },
                    { label: 'Fluency', val: report?.fluency },
                    { label: 'Intonation', val: report?.intonation },
                    { label: 'Vocab', val: report?.vocabulary },
                  ].map((s, i) => (
                    <div key={i} className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                      <div className="text-[10px] uppercase font-black text-zinc-500 mb-1">{s.label}</div>
                      <div className="text-2xl font-black text-indigo-400">{s.val}%</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-500" />
                    Missed Words
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {report?.missed_words?.length > 0 ? report.missed_words.map((word: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm font-bold">
                        {word}
                      </span>
                    )) : (
                      <span className="text-zinc-500 italic">No significant errors detected.</span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setStep(1)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                  <RefreshCw className="w-5 h-5" />
                  Start New Test
                </button>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-zinc-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white">Waiting for Setup</h3>
                  <p className="text-zinc-500 font-medium max-w-xs mx-auto">Complete the steps on the left to begin the reading assessment.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ReadingTest;
