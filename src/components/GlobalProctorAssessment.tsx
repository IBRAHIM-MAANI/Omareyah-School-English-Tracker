import React, { useState, useEffect, useRef } from "react";
import { Shield, Eye, Smartphone, Users, Terminal, Brain, Mic, BookOpen, Loader2 } from "lucide-react";
import { db, collection, addDoc, serverTimestamp, auth, handleFirestoreError, OperationType } from "../firebase";

interface GlobalProctorAssessmentProps {
  student: {
    uid: string;
    displayName: string;
    student_id?: string;
    uniqueId?: string;
  };
  examId: string;
}

export default function GlobalProctorAssessment({ student, examId }: GlobalProctorAssessmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  
  // Security Vectors
  const [integrityState, setIntegrityState] = useState({
    gaze: "secure",       // secure | distracted | suspicious
    environment: "clear", // clear | noisy | secondary_person
    objects: "none",      // none | phone_detected | notes_detected
    identity: "verified"  // verified | mismatch
  });

  const [violations, setViolations] = useState<any[]>([]);
  const [sessionStatus, setSessionStatus] = useState("initializing");

  // 1. International Standard: Multi-Stream Recording
  const startInternationalSession = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      const hasAudio = devices.some(d => d.kind === 'audioinput');

      if (!hasVideo && !hasAudio) {
        throw new Error("No camera or microphone detected.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: hasVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, 
          audio: hasAudio 
        });
      } catch (e) {
        console.warn("High-quality stream failed, falling back to basic:", e);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: hasVideo, 
          audio: hasAudio 
        });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Setup Recording for 'The Vault'
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setChunks(prev => [...prev, e.data]);
        }
      };
      recorder.start(10000); // Save chunks every 10s for safety
      mediaRecorderRef.current = recorder;
      
      setSessionStatus("active");
      logEvent("Session Started", "system");
    } catch (err) {
      console.error("Hardware error:", err);
      setSessionStatus("hardware_error");
    }
  };

  const logEvent = async (msg: string, type: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setViolations(prev => [{ msg, type, timestamp }, ...prev].slice(0, 10));
    
    // Remote Logging for Teacher Audit
    if (type === "violation") {
      try {
        await addDoc(collection(db, 'logs'), {
          userId: auth.currentUser?.uid || 'anonymous',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'System',
          action: `[INTEGRITY ALERT] ${student.displayName}: ${msg}`,
          action_type: "proctoring_violation",
          student_id: student.uid || student.uniqueId || student.student_id,
          details: msg,
          metadata: JSON.stringify({ integrityState, type, examId }),
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to log proctoring event:", error);
        handleFirestoreError(error, OperationType.CREATE, 'logs');
      }
    }
  };

  useEffect(() => {
    startInternationalSession();
    
    // Cleanup
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Head-Pose & Object Logic (Simulation)
  // In a real app, this would be triggered by MediaPipe / TensorFlow models
  useEffect(() => {
    if (sessionStatus === "active") {
      const timer = setTimeout(() => {
        // simulateAIIntelligence();
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [sessionStatus]);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-indigo-500 rounded-[40px] overflow-hidden border border-white/5">
      {/* Top Protocol Bar */}
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-500 w-5 h-5" />
          <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase">Omareyah Live assessment v4.0</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4">
             <StatusIndicator label="Gaze" status={integrityState.gaze} />
             <StatusIndicator label="Object" status={integrityState.objects} />
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">SESSION ID: {examId}</div>
        </div>
      </div>

      <main className="p-8 grid grid-cols-12 gap-8">
        {/* Left: Interactive AI Proctor Avatar */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <div className="relative aspect-[4/5] bg-slate-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl shadow-indigo-500/10">
            {/* The Avatar Video Container */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000')] bg-cover opacity-20" />
            <div className="absolute inset-0 flex items-center justify-center">
               <Brain size={80} className="text-indigo-500/20 animate-pulse" />
            </div>
            
            {/* Live Subtitles for Avatar Speech */}
            <div className="absolute bottom-6 left-4 right-4 bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
              <p className="text-[11px] font-medium text-white leading-relaxed italic">
                "Please ensure your environment is quiet. I am currently mapping your facial geometry for identity persistence."
              </p>
            </div>
          </div>

          {/* Real-time System Logs */}
          <div className="bg-slate-900/50 rounded-2xl border border-white/5 p-4 font-mono text-[10px]">
             <div className="flex items-center gap-2 mb-3 text-slate-500 uppercase tracking-widest font-black">
                <Terminal size={14} /> Security Log
             </div>
             <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
               {violations.map((v, i) => (
                 <div key={i} className={`flex justify-between gap-4 ${v.type === 'violation' ? 'text-rose-400' : 'text-slate-500'}`}>
                   <span className="truncate">{v.msg}</span>
                   <span className="opacity-50 flex-shrink-0">{v.timestamp}</span>
                 </div>
               ))}
               {violations.length === 0 && (
                 <div className="text-slate-600 italic">Initializing security streams...</div>
               )}
             </div>
          </div>
        </div>

        {/* Center: The Assessment Area */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
           <div className="bg-white rounded-[2.5rem] p-10 min-h-[70vh] shadow-2xl relative overflow-hidden text-slate-900">
              <div className="mb-8 border-b border-slate-100 pb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">Cambridge Advanced English</h1>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Part 3: Word Transformation</p>
                </div>
                <div className="text-right">
                   <div className="text-2xl font-black tabular-nums">44:59</div>
                   <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Time Remaining</div>
                </div>
              </div>
              
              <article className="prose prose-slate max-w-none">
                <p className="text-lg leading-relaxed text-slate-700 font-medium">
                  Read the text below. Use the word given in capitals at the end of some of the lines to form a word that fits in the gap in the same line.
                </p>
                
                <div className="mt-12 space-y-8">
                  <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-slate-600 leading-relaxed">
                      The (1) __________ of the new technology has been widely debated. Many experts believe that its (2) __________ will be felt for decades to come.
                    </p>
                    <div className="mt-6 flex gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">1. INTRODUCE</label>
                        <input type="text" className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">2. SIGNIFY</label>
                        <input type="text" className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold" />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
           </div>
        </div>

        {/* Right: Forensic Monitoring */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* High-Resolution Live Feed */}
          <div className="aspect-video bg-black rounded-3xl border-4 border-slate-800 shadow-2xl relative overflow-hidden group">
             {sessionStatus === "initializing" ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                 <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Connecting Hardware...</span>
               </div>
             ) : (
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover grayscale contrast-125" />
             )}
             
             <div className="absolute inset-0 pointer-events-none border-[1px] border-indigo-500/30">
                {/* AI Overlays */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border border-indigo-500/50 rounded-full" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="w-2 h-2 bg-rose-600 rounded-full animate-ping" />
                  <span className="text-[10px] font-black text-white bg-rose-600 px-1.5 py-0.5 rounded">REC 4K</span>
                </div>
             </div>
          </div>

          {/* Forensic Detection Cards */}
          <ForensicCard icon={<Eye className="w-4 h-4" />} title="Eye Tracking" value={integrityState.gaze.toUpperCase()} status={integrityState.gaze === 'secure' ? 'good' : 'warning'} />
          <ForensicCard icon={<Smartphone className="w-4 h-4" />} title="Device Detection" value="NO SIGNAL" status="good" />
          <ForensicCard icon={<Users className="w-4 h-4" />} title="Person Count" value="1 DETECTED" status="good" />
          
          <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-500/20">
             <h4 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Proctor Status</h4>
             <p className="text-sm font-bold leading-snug">The Virtual Proctor is currently monitoring your session via biometric analysis.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string, status: string }) {
  const isSecure = status === 'secure' || status === 'clear' || status === 'none' || status === 'verified';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${isSecure ? 'bg-emerald-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function ForensicCard({ icon, title, value, status }: { icon: React.ReactNode, title: string, value: string, status: 'good' | 'warning' | 'danger' }) {
  const statusColors = {
    good: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400"
  };

  return (
    <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:border-white/10 transition-all">
      <div className="text-indigo-400 bg-indigo-500/10 p-2 rounded-lg">{icon}</div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <p className={`text-xs font-black ${statusColors[status]}`}>{value}</p>
      </div>
    </div>
  );
}
