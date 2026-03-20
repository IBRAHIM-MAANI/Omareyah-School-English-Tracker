import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Play, Square, FileText, CheckCircle, AlertCircle, Loader2, ChevronRight, User, LogOut, Plus } from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { MASTER_EXAMINER_PROMPT, SILENT_PROCTOR_PROMPT, TOOLS } from '../constants';
import { auth, db, collection, setDoc, doc, Timestamp, handleFirestoreError, OperationType, googleProvider, getDoc, query, where, getDocs, onSnapshot, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import TeacherPortal from './TeacherPortal';
import StudentPortal from './StudentPortal';
import AcademicRecords from './AcademicRecords';
import ScoreDashboard from './ScoreDashboard';

type AppView = 'speaking' | 'teacher' | 'student' | 'records' | 'dashboard';

const AssessmentInterface: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin' | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('speaking');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedTool, setSelectedTool] = useState(TOOLS[0]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean }[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<{ topic: string; questions: string[] } | null>(null);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            // Default new users to student for this demo
            const role = user.email === "ibrahimmaani337@gmail.com" ? 'admin' : 'student';
            await setDoc(doc(db, 'users', user.uid), {
              email: user.email,
              displayName: user.displayName,
              role: role,
              createdAt: Timestamp.now()
            });
            setUserRole(role);
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
        }
      } else {
        setUserRole(null);
      }
      setIsAuthReady(true);
    });

    const unsubscribeTopic = onSnapshot(query(collection(db, 'speaking_topics'), where('isActive', '==', true)), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setActiveTopic({ topic: data.topic, questions: data.questions });
      } else {
        setActiveTopic(null);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeTopic();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcription]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Failed to sign in with Google.");
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError("Failed to sign out.");
      console.error(err);
    }
  };

  const startAssessment = async () => {
    if (!user) return;
    
    setError(null);
    setReport(null);
    setTranscription([]);
    setIsSessionActive(true);
    
    let systemInstruction = '';
    let disableVAD = false;

    if (selectedTool.id === 'silent') {
      if (!activeTopic) {
        setError("No active speaking topic found. Please ask your teacher to set a topic.");
        setIsSessionActive(false);
        return;
      }
      systemInstruction = SILENT_PROCTOR_PROMPT
        .replace('{TOPIC}', activeTopic.topic)
        .replace('{QUESTIONS}', activeTopic.questions.map((q, i) => `${i + 1}. ${q}`).join('\n'));
      disableVAD = true;
    } else {
      systemInstruction = `${MASTER_EXAMINER_PROMPT}\n\n${selectedTool.modifier}`;
    }
    
    try {
      if (!liveServiceRef.current) {
        liveServiceRef.current = new GeminiLiveService();
      }
      
      const voiceName = selectedTool.id === 'silent' ? 'Fenrir' : 'Zephyr';
      
      await liveServiceRef.current.connect(systemInstruction, {
        onTranscription: (text, isModel) => {
          setTranscription(prev => [...prev, { text, isModel }]);
          
          if (isModel && text.includes("The assessment is now complete. Generating your report...")) {
            setIsGeneratingReport(true);
          }
        },
        onMessage: (message) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
            const text = message.serverContent.modelTurn.parts[0].text;
            if (text.includes("[DATA_REPORT]")) {
              saveReport(text);
            }
          }
        },
        onError: (err) => {
          setError("An error occurred during the session.");
          setIsSessionActive(false);
        }
      }, { disableVAD, voiceName });
    } catch (err) {
      setError("Failed to start assessment session.");
      setIsSessionActive(false);
    }
  };

  const stopAssessment = () => {
    liveServiceRef.current?.disconnect();
    setIsSessionActive(false);
  };

  const saveReport = async (fullText: string) => {
    if (!user) return;
    
    try {
      // Parse [DATA_REPORT] block
      const dataMatch = fullText.match(/\[DATA_REPORT\]([\s\S]*?)\[\/DATA_REPORT\]/i);
      if (!dataMatch) {
        console.error("No [DATA_REPORT] found in text");
        return;
      }

      let reportData;
      try {
        reportData = JSON.parse(dataMatch[1].trim());
      } catch (e) {
        console.error("Failed to parse [DATA_REPORT] JSON", e);
        return;
      }

      const { accuracy, fluency, intonation, vocabulary, cefr_level, strengths, weaknesses, improvement_plan } = reportData;

      // Handle audio recording upload
      let audioUrl = null;
      if (liveServiceRef.current) {
        const audioBlob = await liveServiceRef.current.getRecordedAudio();
        if (audioBlob) {
          const audioRef = ref(storage, `assessments/${user.uid}/${Date.now()}.webm`);
          const uploadResult = await uploadBytes(audioRef, audioBlob);
          audioUrl = await getDownloadURL(uploadResult.ref);
        }
      }

      const resultData = {
        studentId: user.uid,
        studentEmail: user.email,
        overallLevel: cefr_level || "N/A",
        strengths: strengths || "",
        weaknesses: weaknesses || "",
        improvementPlan: Array.isArray(improvement_plan) ? improvement_plan : [improvement_plan],
        createdAt: Timestamp.now(),
        toolId: selectedTool.name,
        fullReport: fullText,
        type: 'speaking',
        audioUrl: audioUrl,
        scores: {
          accuracy: accuracy || 0,
          fluency: fluency || 0,
          intonation: intonation || 0,
          vocabulary: vocabulary || 0,
        }
      };

      const resultId = `result_${Date.now()}`;
      // Save to student_assessment_log for the new dashboard
      await setDoc(doc(db, 'student_assessment_log', resultId), resultData);
      // Also save to student_records for unified academic history
      await setDoc(doc(db, 'student_records', resultId), resultData);
      
      setReport(fullText);
      setIsGeneratingReport(false);
      setIsSessionActive(false);
      liveServiceRef.current?.disconnect();
      
      // Show notification
      setSuccess("Your assessment has been recorded! Check your Score Dashboard for details.");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'student_assessment_log');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-emerald-500">CEFR Examiner</h1>
            <p className="text-zinc-400">Professional AI-powered English speaking assessment.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-900/20"
          >
            <User className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">CEFR Examiner</h1>
              <p className="text-xs text-zinc-500">Professional Assessment</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-zinc-800/50 p-1 rounded-xl border border-zinc-700/50">
            <button 
              onClick={() => setCurrentView('speaking')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'speaking' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              Speaking
            </button>
            {(userRole === 'teacher' || userRole === 'admin') && (
              <button 
                onClick={() => setCurrentView('teacher')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'teacher' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
              >
                Teacher Portal
              </button>
            )}
            <button 
              onClick={() => setCurrentView('student')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'student' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              My Progress
            </button>
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              Score Dashboard
            </button>
            <button 
              onClick={() => setCurrentView('records')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'records' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              Academic Records
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium">{user.displayName}</span>
            <span className="text-xs text-zinc-500">{user.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {currentView === 'teacher' ? (
          <TeacherPortal onNavigate={(view, studentId) => {
            setCurrentView(view as AppView);
            if (studentId) setSelectedStudentId(studentId);
          }} />
        ) : currentView === 'student' ? (
          <StudentPortal onNavigate={(view) => setCurrentView(view as AppView)} />
        ) : currentView === 'records' ? (
          <AcademicRecords 
            initialStudentId={selectedStudentId || undefined} 
            onNavigate={(view) => setCurrentView(view as AppView)}
          />
        ) : currentView === 'dashboard' ? (
          <ScoreDashboard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar - Tools */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Assessment Mode</h2>
                <div className="space-y-2">
                  {TOOLS.map((tool) => (
                    <div key={tool.id} className="space-y-2">
                      <button
                        disabled={isSessionActive}
                        onClick={() => setSelectedTool(tool)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          selectedTool.id === tool.id 
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' 
                            : 'bg-zinc-800/50 border-transparent hover:border-zinc-700 text-zinc-400'
                        } ${isSessionActive ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="font-semibold">{tool.name}</div>
                        <div className="text-xs opacity-70">{tool.description}</div>
                      </button>
                      
                      {selectedTool.id === 'silent' && tool.id === 'silent' && (userRole === 'teacher' || userRole === 'admin') && (
                        <button 
                          onClick={() => setCurrentView('teacher')}
                          className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-400 flex items-center justify-center gap-2 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          Manage Topics in Teacher Portal
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {!isSessionActive && !report && (
                <button
                  onClick={startAssessment}
                  className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 rounded-3xl transition-all shadow-xl shadow-emerald-900/20 group"
                >
                  <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
                  Start Assessment
                </button>
              )}

              {isSessionActive && (
                <button
                  onClick={stopAssessment}
                  className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white font-bold py-6 rounded-3xl transition-all shadow-xl shadow-red-900/20"
                >
                  <Square className="w-6 h-6 fill-current" />
                  End Session
                </button>
              )}
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </motion.div>
                )}

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 p-4 rounded-2xl flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{success}</p>
                  </motion.div>
                )}

                {isSessionActive ? (
                  <motion.div 
                    key="session"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col h-[600px] overflow-hidden"
                  >
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">Live Session</span>
                      </div>
                      {selectedTool.id === 'silent' && activeTopic && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg text-xs font-bold text-emerald-500">
                          TOPIC: {activeTopic.topic}
                        </div>
                      )}
                      <div className="text-xs text-zinc-500">Microphone Active</div>
                    </div>
                    
                    <div 
                      ref={scrollRef}
                      className="flex-1 p-6 overflow-y-auto space-y-4 scroll-smooth"
                    >
                      {transcription.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-zinc-500">
                          <Mic className="w-12 h-12 opacity-20" />
                          <p>The examiner is ready. Say "Hello" to begin.</p>
                        </div>
                      )}
                      {transcription.map((t, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: t.isModel ? -10 : 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`flex ${t.isModel ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                            t.isModel 
                              ? 'bg-zinc-800 text-zinc-100 rounded-tl-none' 
                              : 'bg-emerald-600 text-white rounded-tr-none'
                          }`}>
                            {t.text}
                          </div>
                        </motion.div>
                      ))}
                      {isGeneratingReport && (
                        <div className="flex justify-start">
                          <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-3 text-sm text-zinc-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing assessment data...
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : report ? (
                  <motion.div 
                    key="report"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold">Assessment Report</h2>
                        <p className="text-zinc-500 text-sm">Completed on {new Date().toLocaleDateString()}</p>
                      </div>
                      <div className="bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-xl font-bold text-xl">
                        {report.match(/Overall Level: (.*)/)?.[1] || "N/A"}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-400 uppercase flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Strengths
                        </h3>
                        <p className="text-zinc-200 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                          {report.match(/Strengths: (.*)/)?.[1] || "No data available"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-400 uppercase flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          Areas for Improvement
                        </h3>
                        <p className="text-zinc-200 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                          {report.match(/Weaknesses: (.*)/)?.[1] || "No data available"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-zinc-400 uppercase flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        Improvement Plan
                      </h3>
                      <div className="space-y-3">
                        {report.split('Improvement Plan:')[1]?.split('\n').filter(l => l.trim().length > 0).map((step, i) => (
                          <div key={i} className="flex items-start gap-3 bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800">
                            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {i + 1}
                            </div>
                            <p className="text-zinc-300 text-sm">{step.replace(/^\d+\.\s*/, '').trim()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => setReport(null)}
                      className="w-full py-4 text-zinc-400 hover:text-zinc-100 transition-colors text-sm font-medium"
                    >
                      Start New Assessment
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-6"
                  >
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center">
                      <Mic className="w-10 h-10 text-zinc-600" />
                    </div>
                    <div className="max-w-sm space-y-2">
                      <h3 className="text-xl font-bold">Ready to Begin?</h3>
                      <p className="text-zinc-500 text-sm">
                        Select an assessment mode from the sidebar and click start to begin your professional CEFR speaking evaluation.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-600">
                      <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Real-time Feedback</span>
                      <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> CEFR Standards</span>
                      <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Detailed Reports</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AssessmentInterface;
