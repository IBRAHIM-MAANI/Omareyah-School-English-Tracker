import React, { useState, useEffect, useRef } from "react";
import { Lock, Play, Clock, ShieldCheck, Mic, Camera, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { db, doc, getDoc, collection, getDocs, query, where, auth, handleFirestoreError, OperationType } from "../firebase";

interface Question {
  id: number;
  type: "mcq" | "tf" | "open_ended";
  text: string;
  options: string[];
  correctAnswer: string;
  imageUrl: string | null;
  points: number;
}

interface TestTemplate {
  id: string;
  title: string;
  instructions: string;
  questions: Question[];
  activation_time: string;
  duration: number;
  security_level: string;
}

interface OmareyahLiveAssessmentProps {
  student: { uid: string; displayName: string };
  testId?: string;
}

export default function OmareyahLiveAssessment({ student, testId: initialTestId }: OmareyahLiveAssessmentProps) {
  const [testTemplate, setTestTemplate] = useState<TestTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Monitor the Clock and Test Status
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const fetchTest = async () => {
      try {
        let id = initialTestId;
        
        // If no testId provided, find the most recent active test
        if (!id) {
          const q = query(collection(db, 'test_templates'), where('status', '==', 'active'));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            id = snapshot.docs[0].id;
          }
        }

        if (id) {
          const docRef = doc(db, 'test_templates', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as TestTemplate;
            setTestTemplate(data);
            
            const now = new Date();
            const startTime = new Date(data.activation_time);
            
            // Automatic unlock if time has arrived
            if (now >= startTime) {
              setIsUnlocked(true);
            }
          } else {
            setError("Test template not found.");
          }
        } else {
          setError("No active tests available at this time.");
        }
      } catch (err) {
        console.error("Error fetching test:", err);
        setError("Failed to load test details.");
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
    return () => clearInterval(timer);
  }, [initialTestId]);

  // Check unlock status periodically
  useEffect(() => {
    if (testTemplate && !isUnlocked) {
      const startTime = new Date(testTemplate.activation_time);
      if (currentTime >= startTime) {
        setIsUnlocked(true);
      }
    }
  }, [currentTime, testTemplate, isUnlocked]);

  const startProctoredExam = async () => {
    try {
      // 1. Check available devices first to avoid "Requested device not found"
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      const hasAudio = devices.some(d => d.kind === 'audioinput');

      if (!hasVideo && !hasAudio) {
        throw new Error("No camera or microphone detected. Please connect your hardware.");
      }

      let stream: MediaStream;
      
      // Try to get what's available
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: hasVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, 
          audio: hasAudio ? { echoCancellation: true, noiseSuppression: true } : false 
        });
      } catch (e) {
        console.warn("High-quality stream failed, falling back to basic:", e);
        // Fallback to basic
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: hasVideo, 
          audio: hasAudio 
        });
      }

      if (videoRef.current) videoRef.current.srcObject = stream;
      setSessionActive(true);
    } catch (err) {
      console.error("Hardware error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Hardware Error: ${msg}\n\nPlease ensure your devices are connected and permissions are granted.`);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initializing Secure Environment...</p>
      </div>
    </div>
  );

  if (error || !testTemplate) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] border border-slate-200 text-center shadow-xl">
        <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-black text-slate-900 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 mb-6">{error || "No test scheduled."}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
      {/* HEADER: Omareyah School Branding */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">O</div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{testTemplate.title}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Official ELD Assessment</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase">System Clock</p>
            <p className="text-sm font-mono font-bold text-slate-700">{format(currentTime, "pp")}</p>
          </div>
          <div className="h-8 w-[1px] bg-slate-100" />
          <div className={`px-4 py-2 rounded-xl flex items-center gap-2 ${isUnlocked ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {isUnlocked ? <ShieldCheck size={16} /> : <Lock size={16} />}
            <span className="text-xs font-black uppercase">{isUnlocked ? "Exam Ready" : "Locked by Teacher"}</span>
          </div>
        </div>
      </div>

      {/* MAIN VIEW: Waiting Room or Live Proctored Exam */}
      {!sessionActive ? (
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] border border-slate-200 text-center shadow-xl shadow-slate-200/50 mt-10">
          <Clock size={48} className="mx-auto text-indigo-500 mb-4" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Examination Waiting Room</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            The assessment is scheduled for <br/>
            <span className="font-bold text-slate-800">{format(new Date(testTemplate.activation_time), "PPP p")}</span>.
            Please ensure your camera and microphone are ready.
          </p>
          
          <button 
            disabled={!isUnlocked}
            onClick={startProctoredExam}
            className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all shadow-lg ${isUnlocked ? 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            {isUnlocked ? "Enter Secure Session" : "Waiting for Activation..."}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-6xl grid grid-cols-12 gap-6 animate-in fade-in zoom-in-95 duration-500">
           {/* Live Forensic View */}
           <div className="col-span-12 lg:col-span-4 space-y-4">
              <div className="aspect-video bg-black rounded-3xl border-4 border-slate-900 overflow-hidden relative shadow-2xl">
                 <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                 
                 {/* FORENSIC OVERLAY: BURNED INTO THE VIEW */}
                 <div className="absolute top-4 left-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                       <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                       <span className="text-[10px] font-black text-white uppercase">Live Forensic Rec</span>
                    </div>
                    <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                       <p className="text-[9px] font-mono text-white/80">{format(currentTime, "yyyy-MM-dd HH:mm:ss")}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hardware Integrity</h3>
                 <div className="space-y-3">
                    <IntegrityBar icon={<Camera size={14}/>} label="Visual Stream" status="Stable 720p" />
                    <IntegrityBar icon={<Mic size={14}/>} label="Acoustic Data" status="Receiving" />
                 </div>
              </div>
           </div>

            {/* Test Content View */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10 min-h-[70vh] flex flex-col">
               <div className="flex-1">
                  <h2 className="text-2xl font-black text-slate-900 mb-6">{testTemplate.title}</h2>
                  <div className="space-y-12">
                     {testTemplate.questions.map((q, i) => (
                       <div key={q.id} className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
                         <div className="flex justify-between items-start mb-6">
                            <span className="px-3 py-1 bg-white text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-50">
                               Question {i + 1} • {q.points} Points
                            </span>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                               <p className="font-bold text-slate-800 text-lg leading-relaxed">{q.text}</p>
                               {q.imageUrl && (
                                 <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
                                   <img src={q.imageUrl} className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                                 </div>
                               )}
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-inner">
                               {q.type === 'mcq' && (
                                 <div className="space-y-3">
                                   {q.options.map((opt, optIdx) => (
                                     <button 
                                       key={optIdx}
                                       onClick={() => setAnswers({...answers, [q.id]: opt})}
                                       className={`w-full p-4 rounded-xl text-left text-sm font-bold transition-all border ${answers[q.id] === opt ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-indigo-200'}`}
                                     >
                                       {opt}
                                     </button>
                                   ))}
                                 </div>
                               )}

                               {q.type === 'tf' && (
                                 <div className="flex gap-4 h-full items-center">
                                   {["True", "False"].map(val => (
                                     <button 
                                       key={val}
                                       onClick={() => setAnswers({...answers, [q.id]: val})}
                                       className={`flex-1 py-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${answers[q.id] === val ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                                     >
                                       {val}
                                     </button>
                                   ))}
                                 </div>
                               )}

                               {q.type === 'open_ended' && (
                                 <textarea 
                                   className="w-full p-5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px]" 
                                   placeholder="Type your response here..."
                                   value={answers[q.id] || ''}
                                   onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                                 />
                               )}
                            </div>
                         </div>
                       </div>
                     ))}
                  </div>
               </div>
               <button className="self-end mt-10 bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-105 transition-transform uppercase tracking-widest text-xs">
                 Final Submission
               </button>
            </div>
        </div>
      )}
    </div>
  );
}

function IntegrityBar({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) {
  return (
    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
      <span className="text-[10px] font-black text-indigo-600 uppercase">{status}</span>
    </div>
  );
}
