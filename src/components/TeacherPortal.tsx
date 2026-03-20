import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Play, Loader2, AlertCircle, CheckCircle, User, Search, BookOpen, FileText, Award, Download } from 'lucide-react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { READING_SPECIALIST_PROMPT, READING_PASSAGES } from '../constants';
import { auth, db, collection, setDoc, addDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType, getDocs, query, where, onSnapshot } from '../firebase';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const TeacherPortal: React.FC<{ onNavigate?: (view: string, studentId?: string) => void }> = ({ onNavigate }) => {
  const [students, setStudents] = useState<{ id: string; email: string; displayName: string }[]>([]);
  const [passages, setPassages] = useState<{ id: string; title: string; text: string }[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedPassage, setSelectedPassage] = useState<{ id: string; title: string; text: string } | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<{ text: string; isModel: boolean }[]>([]);
  const [showPassageManager, setShowPassageManager] = useState(true);
  const [newPassageTitle, setNewPassageTitle] = useState('');
  const [newPassageText, setNewPassageText] = useState('');
  const [speakingTopics, setSpeakingTopics] = useState<{ id: string; topic: string; questions: string[] }[]>([]);
  const [showTopicManager, setShowTopicManager] = useState(true);
  const [showBilling, setShowBilling] = useState(false);
  const [showStudentAdd, setShowStudentAdd] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newQuestions, setNewQuestions] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  
  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (!auth.currentUser) return;
        // Fetch students linked to this teacher
        const q = query(
          collection(db, 'users'), 
          where('role', '==', 'student'),
          where('teacherId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const studentList = snapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          displayName: doc.data().displayName || doc.data().email
        }));
        setStudents(studentList);
        if (studentList.length > 0) setSelectedStudentId(studentList[0].id);
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };

    const unsubscribePassages = onSnapshot(collection(db, 'reading_passages'), (snapshot) => {
      const passageList = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        text: doc.data().text
      }));
      
      // If no passages in Firestore, use the defaults from constants
      if (passageList.length === 0) {
        setPassages(READING_PASSAGES);
        setSelectedPassage(READING_PASSAGES[0]);
      } else {
        setPassages(passageList);
        setSelectedPassage(passageList[0]);
      }
    });

    const unsubscribeTopics = onSnapshot(collection(db, 'speaking_topics'), (snapshot) => {
      const topicList = snapshot.docs.map(doc => ({
        id: doc.id,
        topic: doc.data().topic,
        questions: doc.data().questions || []
      }));
      setSpeakingTopics(topicList);
    });

    fetchStudents();
    return () => {
      unsubscribePassages();
      unsubscribeTopics();
    };
  }, []);

  const handleAddPassage = async () => {
    if (!newPassageTitle || !newPassageText || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'reading_passages'), {
        title: newPassageTitle,
        text: newPassageText,
        createdBy: auth.currentUser.uid,
        createdAt: Timestamp.now()
      });
      setNewPassageTitle('');
      setNewPassageText('');
      setSuccess("Passage added successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reading_passages');
    }
  };

  const handleDeletePassage = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this passage?")) return;
    try {
      await deleteDoc(doc(db, 'reading_passages', id));
      setSuccess("Passage deleted.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'reading_passages');
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic || !newQuestions || !auth.currentUser) return;
    try {
      // Deactivate all others first
      const q = query(collection(db, 'speaking_topics'), where('isActive', '==', true));
      const snapshot = await getDocs(q);
      const batch = snapshot.docs.map(d => setDoc(doc(db, 'speaking_topics', d.id), { isActive: false }, { merge: true }));
      await Promise.all(batch);

      const questionsArray = newQuestions.split('\n').filter(q => q.trim() !== '');
      await addDoc(collection(db, 'speaking_topics'), {
        topic: newTopic,
        questions: questionsArray,
        createdBy: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        isActive: true
      });
      setNewTopic('');
      setNewQuestions('');
      setSuccess("Speaking topic added and activated successfully.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'speaking_topics');
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this topic?")) return;
    try {
      await deleteDoc(doc(db, 'speaking_topics', id));
      setSuccess("Topic deleted.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'speaking_topics');
    }
  };

  const handleToggleTopic = async (id: string, currentActive: boolean) => {
    try {
      // Deactivate all others if this one is being activated
      if (!currentActive) {
        const q = query(collection(db, 'speaking_topics'), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        const batch = snapshot.docs.map(d => setDoc(doc(db, 'speaking_topics', d.id), { isActive: false }, { merge: true }));
        await Promise.all(batch);
      }
      
      await setDoc(doc(db, 'speaking_topics', id), { isActive: !currentActive }, { merge: true });
      setSuccess(currentActive ? "Topic deactivated." : "Topic activated.");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'speaking_topics');
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName || !newStudentEmail || !auth.currentUser) return;
    setIsAddingStudent(true);
    try {
      // In a real app, we'd use a cloud function to create the user
      // For this demo, we'll just add a record to a 'students' collection linked to this teacher
      await addDoc(collection(db, 'users'), {
        displayName: newStudentName,
        email: newStudentEmail,
        role: 'student',
        teacherId: auth.currentUser.uid,
        createdAt: Timestamp.now()
      });
      setNewStudentName('');
      setNewStudentEmail('');
      setSuccess(`Student ${newStudentName} added to your class.`);
      setShowStudentAdd(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleDownloadReport = (studentId: string) => {
    if (onNavigate) {
      onNavigate('records', studentId);
    }
  };

  const startReadingTest = async () => {
    if (!selectedStudentId || !auth.currentUser || !selectedPassage) return;
    
    setError(null);
    setSuccess(null);
    setTranscription([]);
    setIsSessionActive(true);
    
    const systemInstruction = READING_SPECIALIST_PROMPT.replace('{PASSAGE_TEXT}', selectedPassage.text);
    
    try {
      if (!liveServiceRef.current) {
        liveServiceRef.current = new GeminiLiveService();
      }
      
      await liveServiceRef.current.connect(systemInstruction, {
        onTranscription: (text, isModel) => {
          setTranscription(prev => [...prev, { text, isModel }]);
        },
        onMessage: (message) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
            const text = message.serverContent.modelTurn.parts[0].text;
            if (text.includes("[DATA_REPORT]")) {
              saveReadingResult(text);
            }
          }
        },
        onError: (err) => {
          setError("An error occurred during the session.");
          setIsSessionActive(false);
        }
      });
    } catch (err) {
      setError("Failed to start reading test.");
      setIsSessionActive(false);
    }
  };

  const stopReadingTest = () => {
    liveServiceRef.current?.disconnect();
    setIsSessionActive(false);
  };

  const saveReadingResult = async (fullText: string) => {
    if (!auth.currentUser || !selectedStudentId || !selectedPassage) return;
    
    setIsSaving(true);
    try {
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

      const { accuracy, fluency, intonation, vocabulary, cefr_level, missed_words, improvement_plan } = reportData;

      const testData = {
        studentId: selectedStudentId,
        teacherId: auth.currentUser.uid,
        passageTitle: selectedPassage.title,
        passageText: selectedPassage.text,
        accuracyScore: accuracy || 0,
        fluencyScore: fluency || 0,
        intonationScore: intonation || 0,
        vocabularyScore: vocabulary || 0,
        cefrLevel: cefr_level || "N/A",
        missedWords: missed_words || [],
        improvementPlan: improvement_plan || "",
        visibleToStudent: true,
        createdAt: Timestamp.now()
      };

      const testId = `reading_${Date.now()}`;
      await setDoc(doc(db, 'reading_tests', testId), testData);
      
      // Also save to student_assessment_log for the dashboard
      const assessmentLogData = {
        studentId: selectedStudentId,
        overallLevel: cefr_level || "N/A",
        strengths: `Accuracy: ${accuracy}%, Fluency: ${fluency}%`,
        weaknesses: `Intonation: ${intonation}%, Vocab: ${vocabulary}%`,
        improvementPlan: [improvement_plan],
        createdAt: Timestamp.now(),
        toolId: 'Reading Specialist',
        fullReport: fullText,
        scores: {
          accuracy: accuracy || 0,
          fluency: fluency || 0,
          intonation: intonation || 0,
          vocabulary: vocabulary || 0,
        }
      };
      await addDoc(collection(db, 'student_assessment_log'), assessmentLogData);

      // Also save to student_records for unified academic history
      const recordData = {
        studentId: selectedStudentId,
        studentEmail: students.find(s => s.id === selectedStudentId)?.email || '',
        overallLevel: cefr_level || `${accuracy}% Accuracy`,
        strengths: `Accuracy: ${accuracy}%, Fluency: ${fluency}%`,
        weaknesses: missed_words?.length > 0 ? `Missed words: ${missed_words.join(', ')}` : 'None',
        improvementPlan: [improvement_plan],
        createdAt: Timestamp.now(),
        toolId: 'Reading Specialist',
        fullReport: fullText,
        type: 'reading',
        passageTitle: selectedPassage.title,
        scores: {
          accuracy: accuracy || 0,
          fluency: fluency || 0,
          intonation: intonation || 0,
          vocabulary: vocabulary || 0,
        }
      };
      await addDoc(collection(db, 'student_records'), recordData);
      
      setSuccess("Reading test result saved and shared with student.");
      setIsSessionActive(false);
      liveServiceRef.current?.disconnect();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reading_tests');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-emerald-500">
          <Award className="w-6 h-6" />
          <h2 className="text-xl font-bold">Teacher Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowStudentAdd(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-900/20"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
          <button 
            onClick={() => onNavigate?.('records')}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold transition-all group"
          >
            <Award className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
            Academic Records
          </button>
        </div>
      </div>

      {/* Billing & Premium Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <button 
          onClick={() => setShowBilling(!showBilling)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-amber-500">
            <Award className="w-6 h-6" />
            <h2 className="text-xl font-bold">Premium & Billing</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-500/20">PRO PLAN</span>
            {showBilling ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
          </div>
        </button>
        
        <AnimatePresence>
          {showBilling && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-6 space-y-6 border-t border-zinc-800 pt-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-800/30 p-6 rounded-2xl border border-zinc-700/50 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Subscription Status</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Current Plan:</span>
                    <span className="text-zinc-100 font-bold">Institutional Pro</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-sm">Next Billing:</span>
                    <span className="text-zinc-100 font-bold">April 19, 2026</span>
                  </div>
                  <div className="pt-4 border-t border-zinc-700/50">
                    <p className="text-xs text-zinc-500 mb-2">To renew or upgrade, please use the institutional IBAN:</p>
                    <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-700 font-mono text-xs text-emerald-500 break-all">
                      TR12 3456 7890 1234 5678 9012 34
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800/30 p-6 rounded-2xl border border-zinc-700/50 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Premium Features</h3>
                  <ul className="space-y-2">
                    {[
                      { label: 'AI Detailed Reports', active: true },
                      { label: 'Pronunciation Analysis', active: true },
                      { label: 'Full Band Score (IELTS/TOEFL)', active: true },
                      { label: 'SSML Voice Customization', active: true },
                      { label: 'Student Isolation Mode', active: true }
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className={`w-4 h-4 ${feature.active ? 'text-emerald-500' : 'text-zinc-600'}`} />
                        <span className={feature.active ? 'text-zinc-200' : 'text-zinc-500'}>{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {showStudentAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 text-emerald-500 mb-6">
                <Plus className="w-6 h-6" />
                <h3 className="text-xl font-bold text-zinc-100">Add New Student</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Full Name</label>
                  <input 
                    type="text"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Email Address</label>
                  <input 
                    type="email"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    placeholder="e.g., john@example.com"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-8">
                <button 
                  onClick={() => setShowStudentAdd(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddStudent}
                  disabled={isAddingStudent || !newStudentName || !newStudentEmail}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingStudent ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Add Student'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active Topic Summary */}
      {speakingTopics.find(t => (t as any).isActive) && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <Mic className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-zinc-900 rounded-full animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  Live AI Connection Active
                </p>
                <p className="text-xl font-bold text-zinc-100">{speakingTopics.find(t => (t as any).isActive)?.topic}</p>
                <p className="text-xs text-zinc-500">The Silent Proctor AI is now using this topic for all assessments.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => {
                  const active = speakingTopics.find(t => (t as any).isActive);
                  if (active) {
                    alert(`AI SYSTEM INSTRUCTION PREVIEW:\n\nTopic: ${active.topic}\nQuestions:\n${active.questions.map((q, i) => `${i+1}. ${q}`).join('\n')}\n\nMode: Silent Proctor (No interruptions, waits for "That's it")`);
                  }
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 px-6 rounded-xl transition-all border border-zinc-700"
              >
                <FileText className="w-4 h-4" />
                Preview AI Brain
              </button>
              <button 
                onClick={() => onNavigate?.('speaking')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Test with AI Assessor
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">AI Response Mode</p>
              <p className="text-sm font-medium text-zinc-300">Silent Proctor (Patient)</p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Trigger Phrase</p>
              <p className="text-sm font-medium text-zinc-300">"That's it."</p>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Assessment Sync</p>
              <p className="text-sm font-medium text-emerald-500 flex items-center gap-2">
                <CheckCircle className="w-3 h-3" />
                Real-time Connected
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Passage Manager */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <button 
          onClick={() => setShowPassageManager(!showPassageManager)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-blue-500">
            <FileText className="w-6 h-6" />
            <h2 className="text-xl font-bold">Manage Reading Passages</h2>
          </div>
          {showPassageManager ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
        </button>
        
        <AnimatePresence>
          {showPassageManager && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-6 space-y-6 border-t border-zinc-800 pt-6"
            >
              <div className="space-y-4 bg-zinc-800/30 p-4 rounded-2xl border border-zinc-700/50">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Add New Passage</h3>
                <div className="space-y-3">
                  <input 
                    type="text"
                    placeholder="Passage Title"
                    value={newPassageTitle}
                    onChange={(e) => setNewPassageTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <textarea 
                    placeholder="Passage Text"
                    value={newPassageText}
                    onChange={(e) => setNewPassageText(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                  <button 
                    onClick={handleAddPassage}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add Passage
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Existing Passages</h3>
                <div className="grid grid-cols-1 gap-3">
                  {passages.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/30">
                      <div>
                        <p className="font-bold text-sm">{p.title}</p>
                        <p className="text-xs text-zinc-500 truncate max-w-md">{p.text}</p>
                      </div>
                      <button 
                        onClick={() => handleDeletePassage(p.id)}
                        className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Speaking Topic Manager */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <button 
          onClick={() => setShowTopicManager(!showTopicManager)}
          className="w-full p-6 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-3 text-emerald-500">
            <Mic className="w-6 h-6" />
            <h2 className="text-xl font-bold">Manage Speaking Topics</h2>
          </div>
          {showTopicManager ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
        </button>
        
        <AnimatePresence>
          {showTopicManager && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-6 space-y-6 border-t border-zinc-800 pt-6"
            >
              <div className="space-y-4 bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/30">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <Plus className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Create New Speaking Assessment</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Topic Name</label>
                    <input 
                      type="text"
                      placeholder="e.g., Environmental Issues"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Specific Questions (One per line)</label>
                    <textarea 
                      placeholder="1. What is global warming?&#10;2. How can we help?&#10;3. Why is it important?"
                      value={newQuestions}
                      onChange={(e) => setNewQuestions(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                  </div>
                  <button 
                    onClick={handleAddTopic}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <Plus className="w-4 h-4" /> Save & Activate Topic
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Existing Speaking Topics</h3>
                <div className="grid grid-cols-1 gap-3">
                  {speakingTopics.length === 0 ? (
                    <p className="text-sm text-zinc-500">No speaking topics added yet.</p>
                  ) : (
                    speakingTopics.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/30">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{t.topic}</p>
                            {(t as any).isActive && (
                              <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">ACTIVE</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">{t.questions.length} Questions</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleToggleTopic(t.id, (t as any).isActive)}
                            className={`p-2 rounded-lg transition-all ${ (t as any).isActive ? 'bg-emerald-500/20 text-emerald-500' : 'hover:bg-zinc-700 text-zinc-500' }`}
                            title={ (t as any).isActive ? "Deactivate" : "Set as Active" }
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteTopic(t.id)}
                            className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Student Management Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-2 text-zinc-400">
              <User className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Student Management</span>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {students.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">No students found.</div>
              ) : (
                students.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-800 rounded-2xl group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center text-xs font-bold">
                        {student.displayName.charAt(0)}
                      </div>
                      <div className="text-sm font-bold truncate max-w-[100px]">{student.displayName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDownloadReport(student.id)}
                        className="p-2 hover:bg-zinc-700 rounded-lg text-emerald-500 hover:text-emerald-400 transition-colors"
                        title="Download Family Report"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Reading Test Control */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center gap-3 text-emerald-500">
              <BookOpen className="w-6 h-6" />
              <h2 className="text-xl font-bold">Teacher Reading Control</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Select Student</label>
                <select 
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={isSessionActive}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.displayName}</option>
                  ))}
                </select>
              </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">Select Passage</label>
            <select 
              value={selectedPassage?.id || ''}
              onChange={(e) => setSelectedPassage(passages.find(p => p.id === e.target.value) || null)}
              disabled={isSessionActive}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
            >
              {passages.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedPassage && (
          <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
            <h3 className="text-sm font-semibold text-zinc-400 mb-2">Passage Preview:</h3>
            <p className="text-zinc-300 italic">"{selectedPassage.text}"</p>
          </div>
        )}

        {!isSessionActive ? (
          <button
            onClick={startReadingTest}
            disabled={!selectedPassage}
            className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
          >
            <Mic className="w-5 h-5" />
            Start Reading Test
          </button>
        ) : (
          <button
            onClick={stopReadingTest}
            className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-900/20"
          >
            <Square className="w-5 h-5" />
            Stop Test
          </button>
        )}
      </div>
    </div>
  </div>

  <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 p-4 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            <p className="text-sm">{success}</p>
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {isSessionActive && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Live Reading Analysis</span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2 text-sm text-zinc-400">
            {transcription.map((t, i) => (
              <div key={i} className={t.isModel ? 'text-emerald-500' : 'text-zinc-300'}>
                {t.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPortal;
