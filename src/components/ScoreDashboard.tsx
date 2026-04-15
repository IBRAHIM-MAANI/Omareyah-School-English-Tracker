import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { auth, db, collection, query, where, orderBy, onSnapshot } from '../firebase';
import { FileText, Calendar, Award, ChevronRight, Info, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface AssessmentLog {
  id: string;
  studentId: string;
  overallLevel: string;
  strengths: string;
  weaknesses: string;
  improvementPlan: string[];
  createdAt: Timestamp;
  toolId: string;
  fullReport: string;
  examScore?: string;
  scores: {
    accuracy?: number;
    fluency?: number;
    intonation?: number;
    vocabulary?: number;
    // Keep old ones for compatibility if any exist
    vocab?: number;
    grammar?: number;
    pronunciation?: number;
  };
}

const ScoreDashboard: React.FC = () => {
  const [logs, setLogs] = useState<AssessmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AssessmentLog | null>(null);
  const [radarData, setRadarData] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'student_assessment_log'),
      where('studentId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AssessmentLog[];
      setLogs(logsData);
      
      if (logsData.length > 0) {
        const latest = logsData[0];
        if (latest.scores) {
          // Map scores to radar data, prioritizing the new norms
          const scores = latest.scores;
          setRadarData([
            { subject: 'Accuracy', A: scores.accuracy ?? 0, fullMark: 100 },
            { subject: 'Fluency', A: scores.fluency ?? 0, fullMark: 100 },
            { subject: 'Intonation', A: scores.intonation ?? scores.pronunciation ?? 0, fullMark: 100 },
            { subject: 'Vocabulary', A: scores.vocabulary ?? scores.vocab ?? 0, fullMark: 100 },
          ]);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching assessment logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleDownloadReport = (log: AssessmentLog) => {
    setSelectedLog(log);
    // Use a timeout to ensure modal is rendered before printing
    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12 print:p-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 print:hidden">
        <div className="space-y-2">
          <h2 className="text-5xl font-black tracking-tighter text-white">Dashboard</h2>
          <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">Linguistic Competency Analytics</p>
        </div>
        <div className="bg-white/5 backdrop-blur-xl text-indigo-400 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 border border-white/10 shadow-xl">
          <Award className="w-4 h-4" />
          {logs.length} Assessments Logged
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
        {/* Section 1: Skill Radar Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel rounded-[40px] p-10 space-y-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                <Award className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Skill Radar</span>
            </div>
            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Latest Metrics</div>
          </div>
          
          {radarData.length > 0 ? (
            <div className="h-80 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 900, letterSpacing: '0.1em' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Skills"
                    dataKey="A"
                    stroke="#818cf8"
                    fill="#818cf8"
                    fillOpacity={0.3}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 900, color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-center text-zinc-600 space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
                <Info className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm font-bold">Complete an assessment to see your skill radar.</p>
            </div>
          )}
        </motion.div>

        {/* Section 2: Historical Progress List */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel rounded-[40px] p-10 space-y-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Historical Progress</span>
            </div>
            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Activity Log</div>
          </div>

          <div className="max-h-[320px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="text-center py-20 text-zinc-600">
                <p className="font-bold text-sm">No assessment history found.</p>
              </div>
            ) : (
              logs.map((log) => (
                <button 
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 hover:border-white/20 transition-all group/item text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover/item:scale-110 transition-transform">
                      <Calendar className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <div className="font-black text-white text-sm">{log.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{log.toolId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[8px] uppercase tracking-[0.2em] text-zinc-600 font-black">CEFR LEVEL</div>
                      <div className="text-xl font-black text-indigo-400 leading-none mt-1">{log.overallLevel}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/item:bg-white/10 transition-colors">
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover/item:text-white" />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Section 3: Grading Ground Legend */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-6 flex items-start gap-4 print:hidden"
      >
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-500/20">
          <Info className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h3 className="font-black text-zinc-100 uppercase tracking-widest text-sm">Grading Ground Legend</h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium mt-1">
            Your scores are calculated using the International CEFR standard, measuring your ability to communicate clearly, accurately, and naturally in real-world scenarios. We focus on four universal pillars: Accuracy, Fluency, Intonation, and Vocabulary.
          </p>
        </div>
      </motion.div>

      {/* Detail Modal / Printable Report */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:relative print:inset-auto print:bg-white print:p-0 print:z-0"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel rounded-[40px] w-full max-w-2xl max-h-[80vh] overflow-y-auto custom-scrollbar print:max-h-none print:w-full print:max-w-none print:border-none print:bg-white print:text-black"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black/40 backdrop-blur-3xl z-10 print:hidden">
                <h2 className="text-xl font-black tracking-tight">Assessment Details</h2>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 print:p-12">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 print:text-zinc-600">{selectedLog.createdAt.toDate().toLocaleString()}</div>
                    <div className="text-3xl font-black tracking-tighter print:text-3xl">{selectedLog.toolId} Evaluation</div>
                    <div className="text-xs font-bold text-zinc-400 print:text-zinc-600">Student: {auth.currentUser?.displayName || auth.currentUser?.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="bg-indigo-500/20 text-indigo-400 px-6 py-3 rounded-2xl font-black text-3xl border border-indigo-500/20 print:border print:border-emerald-500">
                      {selectedLog.overallLevel}
                    </div>
                    {selectedLog.examScore && (
                      <div className="bg-amber-500/20 text-amber-400 px-4 py-2 rounded-xl font-black text-sm border border-amber-500/20">
                        Exam Score: {selectedLog.examScore}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Accuracy', val: selectedLog.scores?.accuracy ?? 0 },
                    { label: 'Fluency', val: selectedLog.scores?.fluency ?? 0 },
                    { label: 'Intonation', val: selectedLog.scores?.intonation ?? selectedLog.scores?.pronunciation ?? 0 },
                    { label: 'Vocab', val: selectedLog.scores?.vocabulary ?? selectedLog.scores?.vocab ?? 0 },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center print:bg-zinc-100 print:border-zinc-200">
                      <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-1">{s.label}</div>
                      <div className="text-lg font-black text-indigo-400">{s.val}%</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      Strengths
                    </h3>
                    <div className="text-sm font-medium text-zinc-200 bg-white/5 p-4 rounded-2xl border border-white/5 print:bg-zinc-50 print:text-black print:border-zinc-200">{selectedLog.strengths}</div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      Weaknesses
                    </h3>
                    <div className="text-sm font-medium text-zinc-200 bg-white/5 p-4 rounded-2xl border border-white/5 print:bg-zinc-50 print:text-black print:border-zinc-200">{selectedLog.weaknesses}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Improvement Plan</h3>
                  <div className="space-y-2">
                    {selectedLog.improvementPlan.map((step, i) => (
                      <div key={i} className="flex items-start gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 print:bg-zinc-50 print:text-black print:border-zinc-200">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black flex-shrink-0 print:bg-zinc-200">
                          {i + 1}
                        </div>
                        <p className="text-zinc-300 text-sm font-medium print:text-black">{step.replace(/^\d+\.\s*/, '').trim()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 print:hidden">
                  <button 
                    onClick={() => handleDownloadReport(selectedLog)}
                    className="flex-1 py-4 bg-white text-black hover:bg-zinc-200 font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
                  >
                    <FileText className="w-5 h-5" />
                    Download for Family
                  </button>
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all border border-white/10"
                  >
                    Close
                  </button>
                </div>

                <div className="hidden print:block text-center text-[10px] text-zinc-400 pt-12 border-t border-zinc-100">
                  This is an automated linguistic assessment generated by the AI Reading Specialist.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScoreDashboard;
