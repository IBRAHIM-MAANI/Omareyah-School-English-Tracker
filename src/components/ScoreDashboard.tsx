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
  }, []);

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
    <div className="space-y-8 pb-12 print:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold">Score Dashboard</h2>
          <p className="text-zinc-500 text-sm">Your linguistic competency breakdown and history.</p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
          <Award className="w-4 h-4" />
          {logs.length} Assessments Logged
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
        {/* Section 1: Skill Radar Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6"
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Award className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Skill Radar (Latest Assessment)</span>
          </div>
          
          {radarData.length > 0 ? (
            <div className="h-80 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#27272a" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Skills"
                    dataKey="A"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-center text-zinc-500 space-y-4">
              <Info className="w-12 h-12 opacity-20" />
              <p>Complete an assessment to see your skill radar.</p>
            </div>
          )}
        </motion.div>

        {/* Section 2: Historical Progress List */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6"
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Historical Progress</span>
          </div>

          <div className="max-h-[320px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p>No assessment history found.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-800 rounded-2xl hover:border-emerald-500/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{log.createdAt.toDate().toLocaleDateString()}</div>
                      <div className="text-xs text-zinc-500">{log.toolId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">CEFR</div>
                      <div className="text-lg font-black text-emerald-500">{log.overallLevel}</div>
                    </div>
                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Section 3: Grading Ground Legend */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-start gap-4 print:hidden"
      >
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Info className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h3 className="font-bold text-zinc-100">Grading Ground Legend</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
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
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-y-auto print:max-h-none print:w-full print:max-w-none print:border-none print:bg-white print:text-black"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10 print:hidden">
                <h2 className="text-xl font-bold">Assessment Details</h2>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 print:p-12">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm text-zinc-500 print:text-zinc-600">{selectedLog.createdAt.toDate().toLocaleString()}</div>
                    <div className="text-2xl font-bold print:text-3xl">{selectedLog.toolId} Evaluation</div>
                    <div className="text-sm text-zinc-400 print:text-zinc-600">Student: {auth.currentUser?.displayName || auth.currentUser?.email}</div>
                  </div>
                  <div className="bg-emerald-500/20 text-emerald-500 px-6 py-3 rounded-2xl font-black text-3xl print:border print:border-emerald-500">
                    {selectedLog.overallLevel}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Accuracy', val: selectedLog.scores?.accuracy ?? 0 },
                    { label: 'Fluency', val: selectedLog.scores?.fluency ?? 0 },
                    { label: 'Intonation', val: selectedLog.scores?.intonation ?? selectedLog.scores?.pronunciation ?? 0 },
                    { label: 'Vocab', val: selectedLog.scores?.vocabulary ?? selectedLog.scores?.vocab ?? 0 },
                  ].map((s, i) => (
                    <div key={i} className="bg-zinc-800/50 p-3 rounded-2xl border border-zinc-800 text-center print:bg-zinc-100 print:border-zinc-200">
                      <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">{s.label}</div>
                      <div className="text-lg font-bold text-emerald-500">{s.val}%</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Strengths
                    </h3>
                    <p className="text-zinc-200 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:text-black print:border-zinc-200">{selectedLog.strengths}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      Weaknesses
                    </h3>
                    <p className="text-zinc-200 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:text-black print:border-zinc-200">{selectedLog.weaknesses}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase text-zinc-500">Improvement Plan</h3>
                  <div className="space-y-2">
                    {selectedLog.improvementPlan.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 bg-zinc-800/30 p-4 rounded-xl border border-zinc-800 print:bg-zinc-50 print:text-black print:border-zinc-200">
                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold flex-shrink-0 print:bg-zinc-200">
                          {i + 1}
                        </div>
                        <p className="text-zinc-300 text-sm print:text-black">{step.replace(/^\d+\.\s*/, '').trim()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 print:hidden">
                  <button 
                    onClick={() => handleDownloadReport(selectedLog)}
                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    Download for Family
                  </button>
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all"
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
