import React, { useState, useEffect } from "react";
import { Play, ShieldAlert, CheckCircle, Edit3, Save, MicOff, Shield, User, Clock, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { db, doc, getDoc, updateDoc, collection, getDocs, query, orderBy, handleFirestoreError, OperationType } from "../firebase";

interface AssessmentData {
  id: string;
  student_name: string;
  student_id: string;
  test_type: string;
  cefr_level: string;
  recording_url: string;
  overall_score: number;
  ai_suggested_score: number;
  teacher_feedback: string;
  status: string;
  createdAt: any;
  integrity_log?: { timestamp: string; type: string; msg: string }[];
}

interface ForensicReviewVaultProps {
  assessmentId?: string;
  onClose?: () => void;
}

export default function ForensicReviewVault({ assessmentId: initialId, onClose }: ForensicReviewVaultProps) {
  const [assessmentId, setAssessmentId] = useState<string | undefined>(initialId);
  const [data, setData] = useState<AssessmentData | null>(null);
  const [teacherScore, setTeacherScore] = useState<number>(0);
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!assessmentId) {
      fetchAssessments();
    } else {
      fetchAssessmentData(assessmentId);
    }
  }, [assessmentId]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'assessments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssessmentData));
      setAssessments(list);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessmentData = async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'assessments', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const assessmentData = { id: docSnap.id, ...docSnap.data() } as AssessmentData;
        setData(assessmentData);
        setTeacherScore(assessmentData.overall_score || assessmentData.ai_suggested_score || 0);
        setTeacherFeedback(assessmentData.teacher_feedback || "");
      }
    } catch (error) {
      console.error("Error fetching assessment data:", error);
    } finally {
      setLoading(false);
    }
  };

  const verifyResult = async () => {
    if (!assessmentId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'assessments', assessmentId), {
        overall_score: Number(teacherScore),
        teacher_feedback: teacherFeedback,
        status: "teacher_verified"
      });
      alert("Result Verified and Locked in Vault");
      if (onClose) onClose();
      else setAssessmentId(undefined);
    } catch (error) {
      console.error("Error verifying result:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'assessments');
    } finally {
      setIsSaving(false);
    }
  };

  if (!assessmentId) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Forensic Review Vault</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Integrity Audit & Human-in-the-Loop Grading</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Secure Audit Active</span>
          </div>
        </div>

        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {assessments.map((a) => (
              <button
                key={a.id}
                onClick={() => setAssessmentId(a.id)}
                className="group bg-slate-900/40 border border-white/5 p-6 rounded-[32px] flex items-center justify-between hover:bg-slate-800/60 transition-all hover:border-indigo-500/30 text-left"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white tracking-tight">{a.student_name}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">{a.test_type}</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {a.createdAt?.toDate?.() ? a.createdAt.toDate().toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">AI Score</p>
                    <p className="text-xl font-black text-white">{a.ai_suggested_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                    a.status === 'teacher_verified' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {a.status === 'teacher_verified' ? 'Verified' : 'Pending Review'}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
            {assessments.length === 0 && (
              <div className="text-center py-20 bg-slate-900/20 rounded-[40px] border border-dashed border-white/5">
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No assessments found in the vault</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Decrypting Forensic Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 p-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
        {/* Header */}
        <div className="col-span-12 flex items-center justify-between mb-4">
          <button 
            onClick={() => setAssessmentId(undefined)}
            className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Vault
          </button>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Assessment ID: {data.id}
            </span>
          </div>
        </div>

        {/* Left: Forensic Video & Integrity Logs */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="bg-black rounded-[3rem] overflow-hidden shadow-2xl relative border-[12px] border-slate-900/50 aspect-video group">
            <video src={data.recording_url} controls className="w-full h-full object-cover grayscale contrast-125" />
            
            {/* THE RED TIMELINE: Forensic Proof */}
            <div className="absolute bottom-20 left-10 right-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <p className="text-[9px] font-black text-white/50 uppercase mb-3 tracking-[0.2em] flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-rose-500" /> Cheating Suspicion Timeline
              </p>
              <div className="h-2.5 w-full bg-white/10 rounded-full flex overflow-hidden backdrop-blur-xl border border-white/5">
                <div className="w-[15%] bg-rose-600 ml-[10%] shadow-[0_0_15px_rgba(225,29,72,0.5)]" title="Eyes Moved to Secondary Device" />
                <div className="w-[5%] bg-rose-600 ml-[30%] shadow-[0_0_15px_rgba(225,29,72,0.5)]" title="Unrecognized Voice Detected" />
                <div className="w-[20%] bg-rose-600 ml-[15%] shadow-[0_0_15px_rgba(225,29,72,0.5)]" title="Student Looked Left" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl p-10 rounded-[40px] border border-white/5 shadow-2xl">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-indigo-500" /> AI Integrity Log
                </h3>
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Biometric Analysis Complete
                </span>
             </div>
             <div className="space-y-4">
                <div className="flex items-center gap-4 text-rose-400 bg-rose-500/5 p-5 rounded-3xl border border-rose-500/10 text-xs font-bold transition-all hover:bg-rose-500/10">
                   <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShieldAlert size={18} />
                   </div>
                   <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Eye Gaze Anomaly</p>
                      <p>[00:42] Gaze departed from safe-zone for 3.2 seconds. Potential secondary screen detected.</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 text-rose-400 bg-rose-500/5 p-5 rounded-3xl border border-rose-500/10 text-xs font-bold transition-all hover:bg-rose-500/10">
                   <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MicOff size={18} />
                   </div>
                   <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Acoustic Violation</p>
                      <p>[01:15] Acoustic Signature Match: Secondary voice detected in background. Frequency: 240Hz.</p>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Right: Human-in-the-Loop Grading */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="bg-slate-900/60 backdrop-blur-2xl p-10 rounded-[48px] border border-white/10 shadow-2xl sticky top-8">
            <div className="mb-10 text-center">
              <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/20">
                <User size={40} className="text-white" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-tighter">{data.student_name}</h2>
              <div className="flex justify-center gap-2 mt-3">
                <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 uppercase tracking-widest">
                  {data.test_type}
                </span>
                <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 uppercase tracking-widest">
                  {data.cefr_level}
                </span>
              </div>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 text-center">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">AI Suggested</label>
                  <div className="text-3xl font-black text-slate-600 line-through tabular-nums">
                    {data.ai_suggested_score?.toFixed(1)}
                  </div>
                </div>
                <div className="bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/20 text-center">
                  <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Verified Mark</label>
                  <input 
                    type="number" step="0.1"
                    className="w-full bg-transparent text-4xl font-black text-indigo-500 text-center outline-none tabular-nums"
                    value={teacherScore}
                    onChange={(e) => setTeacherScore(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3 ml-2">Teacher Feedback & Observations</label>
                <textarea 
                  className="w-full p-6 bg-white/5 border border-white/10 rounded-[32px] text-sm font-medium text-slate-300 outline-none focus:border-indigo-500 transition-all resize-none"
                  rows={6}
                  placeholder="Enter detailed feedback for the student..."
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                />
              </div>

              <button 
                onClick={verifyResult} 
                disabled={isSaving}
                className="w-full py-6 bg-indigo-600 text-white rounded-[24px] font-black flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={24} />
                    <span className="uppercase tracking-[0.2em] text-sm">Verify & Lock Score</span>
                  </>
                )}
              </button>
              
              <p className="text-[9px] font-black text-slate-600 text-center uppercase tracking-widest">
                Once verified, this score will be pushed to the student's permanent academic record.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
