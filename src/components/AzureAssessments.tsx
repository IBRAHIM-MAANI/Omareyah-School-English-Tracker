import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Mic, 
  Database, 
  Search, 
  Play, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  History
} from 'lucide-react';
import { db, collection, getDocs, query, where, onSnapshot, setDoc, doc, Timestamp } from '../firebase';
import { runReadingTest, runSpeakingTest } from '../services/azureSpeechService';
import { uploadToAzureBlob } from '../services/azureStorageService';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type Tab = 'reading' | 'speaking' | 'vault';

interface Student {
  uid: string;
  displayName: string;
  email: string;
  uniqueId: string;
  grade?: string;
}

const AzureAssessments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reading');
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reading Test State
  const [referenceText, setReferenceText] = useState('');
  const [readingResult, setReadingResult] = useState<any>(null);

  // Speaking Test State
  const [spontaneousPrompt, setSpontaneousPrompt] = useState('');
  const [speakingResult, setSpeakingResult] = useState<any>(null);

  // Vault State
  const [recordings, setRecordings] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
      const studentList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as Student[];
      setStudents(studentList);
    });

    const unsubscribeVault = onSnapshot(collection(db, 'azure_recordings'), (snapshot) => {
      const vaultList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setRecordings(vaultList);
    });

    return () => {
      unsubscribe();
      unsubscribeVault();
    };
  }, []);

  const filteredStudents = students.filter(s => 
    s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.uniqueId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shuffleText = () => {
    const texts = [
      "The quick brown fox jumps over the lazy dog.",
      "Artificial intelligence is transforming the way we learn and communicate.",
      "Education is the most powerful weapon which you can use to change the world.",
      "Success is not final, failure is not fatal: it is the courage to continue that counts.",
      "The future belongs to those who believe in the beauty of their dreams."
    ];
    setReferenceText(texts[Math.floor(Math.random() * texts.length)]);
  };

  const handleReadingTest = async () => {
    if (!selectedStudent || !referenceText) return;
    setLoading(true);
    setError(null);
    setReadingResult(null);

    try {
      const result = await runReadingTest(referenceText, selectedStudent.displayName);
      
      // Upload audio to Azure Blob
      if (result.audioData) {
        const audioBlob = new Blob([result.audioData], { type: 'audio/wav' });
        const audioUrl = await uploadToAzureBlob(audioBlob, selectedStudent.uniqueId, "ReadingTest");
        result.audioUrl = audioUrl;

        // Save to DB
        await setDoc(doc(collection(db, 'azure_recordings')), {
          studentId: selectedStudent.uid,
          studentName: selectedStudent.displayName,
          uniqueId: selectedStudent.uniqueId,
          testType: 'Reading',
          audioUrl,
          cefr: result.cefr,
          timestamp: Timestamp.now()
        });
      }
      
      setReadingResult(result);
      setSuccess("Reading assessment completed and saved!");
    } catch (err: any) {
      setError(err.message || "Failed to run reading assessment.");
    } finally {
      setLoading(false);
    }
  };

  const generateSpeakingPrompt = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: "Generate a short, engaging speaking prompt for an 8th-grade English student. The prompt should encourage spontaneous speech about a relatable topic like hobbies, travel, or technology." }] }]
      });
      setSpontaneousPrompt(result.text);
    } catch (err) {
      setError("Failed to generate prompt.");
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakingTest = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    setError(null);
    setSpeakingResult(null);

    try {
      const { text, audioData } = await runSpeakingTest();
      
      // 1. Upload to Azure Blob
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = await uploadToAzureBlob(audioBlob, selectedStudent.uniqueId, "SpeakingTest");

      // 2. Forensic Audit with Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const auditPrompt = `Perform a forensic linguistic audit on the following transcription of a student's speech. 
      Transcription: "${text}"
      Analyze grammar, syntax, and provide a CEFR level (A1-C2). Return a JSON object with fields: cefr, grammar_score, syntax_score, feedback.`;
      
      const auditResult = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: auditPrompt }] }],
        config: { responseMimeType: "application/json" }
      });
      const auditData = JSON.parse(auditResult.text);

      const result = {
        ...auditData,
        transcription: text,
        audioUrl,
        timestamp: Timestamp.now()
      };

      // 3. Save to DB
      await setDoc(doc(collection(db, 'azure_recordings')), {
        studentId: selectedStudent.uid,
        studentName: selectedStudent.displayName,
        uniqueId: selectedStudent.uniqueId,
        testType: 'Speaking',
        audioUrl,
        cefr: result.cefr,
        timestamp: Timestamp.now()
      });

      setSpeakingResult(result);
      setSuccess("Speaking assessment completed and saved!");
    } catch (err: any) {
      setError(err.message || "Failed to run speaking assessment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Azure Assessments</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Advanced Phonology & Linguistic Audit</p>
        </div>
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
          {(['reading', 'speaking', 'vault'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' 
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Student List Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-[32px] p-6 space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
              />
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {filteredStudents.map(student => (
                <button
                  key={student.uid}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all border ${
                    selectedStudent?.uid === student.uid
                      ? 'bg-purple-600/10 border-purple-500/30 text-purple-400'
                      : 'bg-slate-900/30 border-white/5 text-slate-500 hover:bg-white/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                    selectedStudent?.uid === student.uid ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {student.displayName[0]}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-white truncate">{student.displayName}</p>
                    <p className="text-[10px] font-bold opacity-60">{student.uniqueId}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === 'reading' && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="glass-panel rounded-[40px] p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                        <BookOpen className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Reading Assessment</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Phoneme-Level Accuracy Engine</p>
                      </div>
                    </div>
                    <button 
                      onClick={shuffleText}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all border border-white/5"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Reference Text</label>
                    <textarea 
                      value={referenceText}
                      onChange={(e) => setReferenceText(e.target.value)}
                      placeholder="Enter or shuffle text for the student to read..."
                      className="w-full h-40 bg-slate-900/50 border border-white/5 rounded-[32px] p-6 text-sm font-medium text-white outline-none focus:border-blue-500 transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-3">
                      {selectedStudent ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Ready: {selectedStudent.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Select a student to begin</span>
                      )}
                    </div>
                    <button
                      onClick={handleReadingTest}
                      disabled={loading || !selectedStudent || !referenceText}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 flex items-center gap-3"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Start Assessment
                    </button>
                  </div>
                </div>

                {readingResult && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                  >
                    {[
                      { label: 'Accuracy', value: readingResult.accuracy, color: 'text-green-400' },
                      { label: 'Fluency', value: readingResult.fluency, color: 'text-blue-400' },
                      { label: 'Prosody', value: readingResult.prosody, color: 'text-purple-400' },
                      { label: 'CEFR Level', value: readingResult.cefr, color: 'text-amber-400' }
                    ].map(stat => (
                      <div key={stat.label} className="glass-panel rounded-3xl p-6 text-center border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'speaking' && (
              <motion.div
                key="speaking"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="glass-panel rounded-[40px] p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                        <Mic className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Speaking Test</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Spontaneous Speech & Forensic Audit</p>
                      </div>
                    </div>
                    <button 
                      onClick={generateSpeakingPrompt}
                      className="px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 rounded-xl text-purple-400 text-[10px] font-black uppercase tracking-widest transition-all border border-purple-500/20 flex items-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Generate Prompt
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Spontaneous Prompt</label>
                    <div className="w-full bg-slate-900/50 border border-white/5 rounded-[32px] p-8 text-lg font-medium text-white italic text-center leading-relaxed">
                      {spontaneousPrompt || "Click 'Generate Prompt' to start..."}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-3">
                      {selectedStudent ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-full border border-purple-500/20">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Ready: {selectedStudent.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Select a student to begin</span>
                      )}
                    </div>
                    <button
                      onClick={handleSpeakingTest}
                      disabled={loading || !selectedStudent || !spontaneousPrompt}
                      className="px-8 py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-purple-500/20 flex items-center gap-3"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Start Recording
                    </button>
                  </div>
                </div>

                {speakingResult && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel rounded-[32px] p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-6">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Forensic Linguistic Audit</h3>
                      <div className="px-4 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 text-amber-400 text-[10px] font-black">
                        CEFR: {speakingResult.cefr}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transcription</p>
                        <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/5">
                          "{speakingResult.transcription}"
                        </p>
                      </div>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">Grammar Score</span>
                            <span className="text-purple-400">{speakingResult.grammar_score}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${speakingResult.grammar_score}%` }}
                              className="h-full bg-purple-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">Syntax Score</span>
                            <span className="text-blue-400">{speakingResult.syntax_score}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${speakingResult.syntax_score}%` }}
                              className="h-full bg-blue-500"
                            />
                          </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Feedback</p>
                          <p className="text-xs text-slate-400 leading-relaxed">{speakingResult.feedback}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'vault' && (
              <motion.div
                key="vault"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="glass-panel rounded-[40px] p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                      <Database className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight">Recordings Vault</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Secure Cloud Storage Sync</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Student</th>
                          <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Test Type</th>
                          <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">CEFR</th>
                          <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Date</th>
                          <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {recordings.map((rec) => (
                          <tr key={rec.id} className="group hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                                  {rec.studentName[0]}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-white">{rec.studentName}</p>
                                  <p className="text-[9px] text-slate-500 font-bold">{rec.uniqueId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                rec.testType === 'Reading' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              }`}>
                                {rec.testType}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-xs font-black text-amber-400">{rec.cefr}</span>
                            </td>
                            <td className="py-4 px-4 text-xs text-slate-500 font-medium">
                              {rec.timestamp?.toDate().toLocaleDateString()}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => window.open(rec.audioUrl, '_blank')}
                                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                                <a 
                                  href={rec.audioUrl} 
                                  download 
                                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 border border-red-400/20"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 opacity-60 hover:opacity-100">×</button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 border border-green-400/20"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-4 opacity-60 hover:opacity-100">×</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AzureAssessments;
