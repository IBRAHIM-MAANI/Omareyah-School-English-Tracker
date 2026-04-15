import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Upload, User, FileText, Download, Loader2, AlertCircle, CheckCircle, Award, Mic, CheckSquare, Square, Trash2, Printer, Languages, BookOpen } from 'lucide-react';
import { auth, db, collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp, orderBy, Timestamp, updateDoc } from '../firebase';
import { runAzureAssessment, AzureAssessmentResult } from '../services/azureSpeechService';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Student {
  uid: string;
  displayName: string;
  grade: string;
  section: string;
  cefr: string;
  uniqueId: string;
}

interface Recording {
  id: string;
  studentId: string;
  studentEmail: string;
  audioUrl: string;
  createdAt: any;
  type: string;
  toolId: string;
  studentName?: string;
}

interface AuditReport {
  id: string;
  studentId: string;
  studentName: string;
  score: number;
  pronunciationMistakes: string;
  grammaticalMistakes: string;
  improvementPlan: string[];
  timestamp: any;
}

const AuditHub: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecordings, setSelectedRecordings] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'archive' | 'reading'>('audit');
  const [referenceText, setReferenceText] = useState<string>('');
  const [azureResult, setAzureResult] = useState<AzureAssessmentResult | null>(null);
  const [isAzureLoading, setIsAzureLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.warn("No current user found in AuditHub");
          return;
        }

        // Fetch current user data directly by ID
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          console.error("User profile not found in Firestore:", currentUser.uid);
          setError("User profile not found. Please try signing out and back in.");
          return;
        }

        const userData = userDocSnap.data();
        const isAdmin = userData.role === 'admin';
        const isTeacher = userData.role === 'teacher';

        console.log("AuditHub Fetching for role:", userData.role, "Grade:", userData.grade, "Section:", userData.section);

        let studentQ;
        if (isAdmin) {
          studentQ = query(collection(db, 'users'), where('role', '==', 'student'));
        } else if (isTeacher) {
          // If grade or section is missing, teacher might not see any students
          if (!userData.grade || !userData.section) {
            console.warn("Teacher has no grade/section assigned");
            setError("No grade or section assigned to your account. Please contact an administrator.");
            return;
          }
          studentQ = query(
            collection(db, 'users'), 
            where('role', '==', 'student'),
            where('grade', '==', userData.grade),
            where('section', '==', userData.section)
          );
        } else {
          console.warn("Unauthorized role in AuditHub:", userData.role);
          setError("You do not have permission to access this feature.");
          return; 
        }

        const studentSnapshot = await getDocs(studentQ);
        const studentData = studentSnapshot.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) } as Student));
        console.log("Students found:", studentData.length);
        setStudents(studentData);

        // Fetch recordings from student_assessment_log
        const recordingQ = query(collection(db, 'student_assessment_log'), orderBy('createdAt', 'desc'));
        const recordingSnapshot = await getDocs(recordingQ);
        const recordingData = recordingSnapshot.docs.map(doc => {
          const data = doc.data();
          const student = studentData.find(s => s.uid === data.studentId);
          return { 
            id: doc.id, 
            ...(data as any), 
            studentName: student?.displayName || 'Unknown Student'
          } as Recording;
        });
        setRecordings(recordingData);
      } catch (err) {
        console.error("Error fetching audit data:", err);
        setError("Failed to fetch data. You may not have permission to view all records.");
      }
    };
    fetchData();
  }, [auth.currentUser]);

  const normalizeAudio = async (file: File | Blob): Promise<Blob> => {
    if (file.size < 1000) {
      throw new Error("Recording too short. Please upload a valid English voice recording.");
    }

    // Volume Check using AudioContext
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      let maxAmplitude = 0;
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const data = audioBuffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > maxAmplitude) maxAmplitude = abs;
        }
      }

      // If peak amplitude is less than 0.05 (very quiet), warn the user
      if (maxAmplitude < 0.05) {
        console.warn("Recording volume is very low.");
        // We don't throw here to allow processing, but we could add a UI warning
      }
      
      await audioContext.close();
    } catch (e) {
      console.error("Could not analyze audio volume:", e);
    }

    return file;
  };

  const runAIAudit = async (audioUrl: string, studentId: string, studentName: string) => {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const processedAudio = await normalizeAudio(blob);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(processedAudio);
      });
      const base64Data = await base64Promise;

      const prompt = `Analyze this English voice recording for a forensic linguistic audit. 
      Student: ${studentName}
      
      Operational Rules:
      1. Analyze with 100% objectivity. Provide zero flattery.
      2. Focus on phonetic accuracy (IPA mistakes) and syntactic correctness (grammar).
      3. Provide a strict score out of 10.0 (no rounding up).
      4. Return the result in JSON format.
      
      JSON Structure:
      {
        "score": 0.0,
        "pronunciationMistakes": "detailed phonetic analysis",
        "grammaticalMistakes": "detailed syntactic analysis",
        "improvementPlan": ["step 1", "step 2", "step 3"]
      }`;

      const sanitizeMimeType = (type: string) => {
        // Some browsers record audio in a webm container but label it as video/webm
        // Gemini expects frames if it sees video/, so we force it to audio/
        if (type.startsWith('video/')) {
          return type.replace('video/', 'audio/');
        }
        // If it's an empty or generic type, default to audio/webm which is common
        if (!type || type === 'application/octet-stream') {
          return 'audio/webm';
        }
        return type;
      };

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: sanitizeMimeType(blob.type) } }
          ]}
        ],
        config: {
          systemInstruction: "You are a forensic English linguist. Ignore background static. Focus entirely on the human speech to detect phonetic and grammatical errors. No flattery.",
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(aiResponse.text);
      
      const reportData: AuditReport = {
        id: `audit_${Date.now()}`,
        studentId: studentId,
        studentName: studentName,
        score: Math.min(result.score, 10),
        pronunciationMistakes: result.pronunciationMistakes,
        grammaticalMistakes: result.grammaticalMistakes,
        improvementPlan: result.improvementPlan,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'audits'), reportData);
      return reportData;
    } catch (err) {
      console.error("Audit failed for", studentName, err);
      throw err;
    }
  };

  const handleBatchAudit = async () => {
    if (selectedRecordings.length === 0) return;
    
    setIsAuditing(true);
    setError(null);
    setBatchProgress({ current: 0, total: selectedRecordings.length });

    try {
      for (let i = 0; i < selectedRecordings.length; i++) {
        const recId = selectedRecordings[i];
        const recording = recordings.find(r => r.id === recId);
        if (recording) {
          await runAIAudit(recording.audioUrl, recording.studentId, recording.studentName || 'Unknown');
        }
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
      }
      setSelectedRecordings([]);
      alert("Batch audit completed successfully!");
    } catch (err) {
      setError("Batch audit encountered errors. Some recordings may have failed.");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAudit = async (file: File) => {
    if (!selectedStudent) {
      setError("Please select a student first.");
      return;
    }

    setIsAuditing(true);
    setError(null);
    setReport(null);

    try {
      const processedAudio = await normalizeAudio(file);
      const student = students.find(s => s.uid === selectedStudent);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(processedAudio);
      });
      const base64Data = await base64Promise;

      const prompt = `Analyze this English voice recording for a forensic linguistic audit. 
      Student: ${student?.displayName} (CEFR: ${student?.cefr})
      
      Operational Rules:
      1. Analyze with 100% objectivity. Provide zero flattery.
      2. Focus on phonetic accuracy (IPA mistakes) and syntactic correctness (grammar).
      3. Provide a strict score out of 10.0 (no rounding up).
      4. Return the result in JSON format.
      
      JSON Structure:
      {
        "score": 0.0,
        "pronunciationMistakes": "detailed phonetic analysis",
        "grammaticalMistakes": "detailed syntactic analysis",
        "improvementPlan": ["step 1", "step 2", "step 3"]
      }`;

      const sanitizeMimeType = (type: string) => {
        if (type.startsWith('video/')) {
          return type.replace('video/', 'audio/');
        }
        if (!type || type === 'application/octet-stream') {
          return 'audio/webm';
        }
        return type;
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: sanitizeMimeType(file.type) } }
          ]}
        ],
        config: {
          systemInstruction: "You are a forensic English linguist. Ignore background static. Focus entirely on the human speech to detect phonetic and grammatical errors. No flattery.",
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);
      
      const reportData: AuditReport = {
        id: `audit_${Date.now()}`,
        studentId: selectedStudent,
        studentName: student?.displayName || 'Unknown',
        score: Math.min(result.score, 10),
        pronunciationMistakes: result.pronunciationMistakes,
        grammaticalMistakes: result.grammaticalMistakes,
        improvementPlan: result.improvementPlan,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'audits'), reportData);
      setReport(reportData);
    } catch (err: any) {
      console.error("Audit failed:", err);
      setError(err.message || "Forensic audit failed. Please ensure the audio is clear and try again.");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAzureAudit = async (file: File) => {
    if (!selectedStudent) {
      setError("Please select a student first.");
      return;
    }
    if (!referenceText.trim()) {
      setError("Please enter the reference text for the reading assessment.");
      return;
    }

    setIsAzureLoading(true);
    setError(null);
    setAzureResult(null);

    try {
      const result = await runAzureAssessment(file, referenceText);
      setAzureResult(result);

      // Save to Firestore
      const student = students.find(s => s.uid === selectedStudent);
      const assessmentData = {
        studentId: selectedStudent,
        studentName: student?.displayName || 'Unknown',
        type: 'Reading',
        scores: result,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'student_assessment_log'), assessmentData);
      
      logActivity('assessment', `Azure Reading Assessment completed for ${student?.displayName}`, { 
        studentId: selectedStudent, 
        scores: result 
      });

    } catch (err: any) {
      console.error("Azure Assessment failed:", err);
      setError(err.message || "Azure Reading Assessment failed. Please try again.");
    } finally {
      setIsAzureLoading(false);
    }
  };

  const logActivity = async (action: string, details: string, metadata: any = {}) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();

      await addDoc(collection(db, 'activity_logs'), {
        userId: currentUser.uid,
        userName: userData?.displayName || currentUser.email,
        userRole: userData?.role || 'unknown',
        action,
        details,
        metadata,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  const exportPDF = async () => {
    if (!report) return;
    
    const element = document.getElementById('audit-report-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Omareyah_Audit_${report.studentName}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const toggleRecordingSelection = (id: string) => {
    setSelectedRecordings(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const toggleAllRecordings = () => {
    if (selectedRecordings.length === recordings.length) {
      setSelectedRecordings([]);
    } else {
      setSelectedRecordings(recordings.map(r => r.id));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAudit(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-white">Linguistic Audit Hub</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Forensic Analysis • Gemini 3 Flash</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('audit')}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            AI Audit Hub
          </button>
          <button 
            onClick={() => setActiveTab('archive')}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'archive' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            Recordings Archive
          </button>
          <button 
            onClick={() => setActiveTab('reading')}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'reading' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Reading Assessment
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'audit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel rounded-[32px] p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Target Student</label>
                <div className="relative">
                  <select 
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-purple-500 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Select Student...</option>
                    {students.length === 0 && <option value="" disabled className="bg-slate-900">No students found</option>}
                    {students.map(s => (
                      <option key={s.uid} value={s.uid} className="bg-slate-900">
                        {s.displayName} ({s.grade}{s.section})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-[32px] p-12 text-center transition-all duration-300 ${dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/20 bg-white/5'}`}
              >
                <input 
                  type="file" 
                  accept="audio/*"
                  onChange={(e) => e.target.files?.[0] && handleAudit(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto border border-white/5">
                    <Upload className="w-8 h-8 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">Drop Audio File</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WAV or MP3 Preferred (WEBM supported)</p>
                    <p className="text-[9px] font-medium text-purple-400/60 italic">Ensure student is close to mic for best results</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                  <p className="text-xs font-bold text-red-400 leading-relaxed">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {isAuditing ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-panel rounded-[40px] h-full flex flex-col items-center justify-center p-12 text-center space-y-6"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    <Shield className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 text-purple-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white tracking-tighter">Forensic Audit in Progress</h3>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">
                      {batchProgress.total > 0 ? `Analyzing Recording ${batchProgress.current} of ${batchProgress.total}...` : 'Gemini 3 Flash Analyzing Phonemes...'}
                    </p>
                  </div>
                </motion.div>
              ) : report ? (
                <motion.div 
                  key="report"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel rounded-[40px] p-10 space-y-10 relative overflow-hidden"
                  id="audit-report-content"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[100px] -mr-32 -mt-32" />
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black tracking-tighter text-white">Forensic Report</h2>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Student: {report.studentName}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-5xl font-black text-purple-400 tracking-tighter">{report.score.toFixed(1)}</div>
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Strict Score / 10</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Mic className="w-3 h-3 text-purple-500" />
                        Phonetic Mistakes
                      </h3>
                      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl text-sm font-medium text-slate-300 leading-relaxed">
                        {report.pronunciationMistakes}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText className="w-3 h-3 text-blue-500" />
                        Grammatical Audit
                      </h3>
                      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl text-sm font-medium text-slate-300 leading-relaxed">
                        {report.grammaticalMistakes}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Award className="w-3 h-3 text-emerald-500" />
                      Improvement Plan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {report.improvementPlan.map((step, i) => (
                        <div key={i} className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex items-start gap-3">
                          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                            {i + 1}
                          </div>
                          <p className="text-xs font-bold text-emerald-100/80 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={exportPDF}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    <Download className="w-4 h-4" />
                    Export Parent Report (PDF)
                  </button>
                </motion.div>
              ) : (
                <div className="glass-panel rounded-[40px] h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
                  <div className="w-24 h-24 bg-slate-800 rounded-[40px] flex items-center justify-center border border-white/5">
                    <FileText className="w-10 h-10 text-slate-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white tracking-tighter">Ready for Analysis</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">
                      Select a student and upload their recording to generate a forensic linguistic report.
                    </p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : activeTab === 'reading' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel rounded-[32px] p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Target Student</label>
                <div className="relative">
                  <select 
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-purple-500 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Select Student...</option>
                    {students.map(s => (
                      <option key={s.uid} value={s.uid} className="bg-slate-900">
                        {s.displayName} ({s.grade}{s.section})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Reference Text</label>
                <textarea 
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  placeholder="Paste the text the student should read here..."
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-purple-500 transition-all min-h-[150px] resize-none"
                />
              </div>

              <div className="relative border-2 border-dashed border-white/10 hover:border-white/20 bg-white/5 rounded-[32px] p-12 text-center transition-all">
                <input 
                  type="file" 
                  accept="audio/*"
                  onChange={(e) => e.target.files?.[0] && handleAzureAudit(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isAzureLoading}
                />
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto border border-white/5">
                    {isAzureLoading ? <Loader2 className="w-8 h-8 text-purple-500 animate-spin" /> : <BookOpen className="w-8 h-8 text-slate-500" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">Upload Reading Audio</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WAV format recommended for Azure</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {azureResult ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="glass-panel rounded-[40px] p-10 space-y-8 border-purple-500/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                        <Award className="w-8 h-8 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-tighter text-white">Azure AI Assessment</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phoneme-Level Precision Analysis</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black text-white tracking-tighter">{azureResult.overall}</p>
                      <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Overall Score</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Accuracy', value: azureResult.accuracy, color: 'text-emerald-400' },
                      { label: 'Fluency', value: azureResult.fluency, color: 'text-blue-400' },
                      { label: 'Prosody', value: azureResult.prosody, color: 'text-amber-400' },
                      { label: 'Completeness', value: azureResult.completeness, color: 'text-purple-400' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" />
                      Phonetic Feedback
                    </h4>
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
                      <p className="text-sm text-slate-300 leading-relaxed italic">"{azureResult.feedback}"</p>
                    </div>
                  </div>

                  {azureResult.words && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Mic className="w-4 h-4 text-purple-500" />
                        Word-Level Analysis
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {azureResult.words.map((word: any, i: number) => (
                          <div 
                            key={i} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              word.PronunciationAssessment.ErrorType === 'None' 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}
                            title={`Accuracy: ${word.PronunciationAssessment.AccuracyScore}`}
                          >
                            {word.Word}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/5">
                    <Languages className="w-10 h-10 text-slate-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">Ready for Reading Audit</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select a student and upload audio to begin</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-[40px] p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tighter text-white">Saving Recordings Archive</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Reading, Speaking, and Pronunciation Vaults</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={toggleAllRecordings}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all"
              >
                {selectedRecordings.length === recordings.length ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4" />}
                Select All
              </button>
              <button 
                onClick={handleBatchAudit}
                disabled={selectedRecordings.length === 0 || isAuditing}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-purple-500/20"
              >
                <Shield className="w-4 h-4" />
                Run All Audits ({selectedRecordings.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-3">
              <thead>
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Select</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Vault</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Audio</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((rec) => (
                  <tr key={rec.id} className="bg-white/5 hover:bg-white/10 transition-colors group">
                    <td className="px-6 py-4 rounded-l-2xl">
                      <button onClick={() => toggleRecordingSelection(rec.id)}>
                        {selectedRecordings.includes(rec.id) ? (
                          <CheckSquare className="w-5 h-5 text-purple-500" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-black text-xs border border-white/5">
                          {rec.studentName?.[0]}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{rec.studentName}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{rec.studentEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20">
                        {rec.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-400">
                        {rec.createdAt?.toDate().toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <audio src={rec.audioUrl} controls className="h-8 w-48 opacity-50 hover:opacity-100 transition-opacity" />
                    </td>
                    <td className="px-6 py-4 rounded-r-2xl text-right">
                      <button 
                        onClick={() => runAIAudit(rec.audioUrl, rec.studentId, rec.studentName || 'Unknown').then(setReport).then(() => setActiveTab('audit'))}
                        className="p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-lg transition-all"
                        title="Run AI Audit"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditHub;
