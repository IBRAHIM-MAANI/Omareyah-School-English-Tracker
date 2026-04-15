import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Calendar, Award, ChevronRight, Share2, X, CheckCircle, AlertCircle, Download, Printer, User, Mic } from 'lucide-react';
import { db, collection, query, where, orderBy, onSnapshot, auth, getDocs } from '../firebase';
import { Timestamp } from 'firebase/firestore';

interface StudentRecord {
  id: string;
  studentId: string;
  studentEmail: string;
  overallLevel: string;
  strengths: string;
  weaknesses: string;
  improvementPlan: string[];
  createdAt: Timestamp;
  toolId: string;
  fullReport: string;
  type?: 'speaking' | 'reading';
  passageTitle?: string;
  audioUrl?: string;
  examScore?: string;
  scores?: {
    accuracy?: number;
    fluency?: number;
    intonation?: number;
    vocabulary?: number;
    // Keep old ones for compatibility
    vocab?: number;
    grammar?: number;
    pronunciation?: number;
  };
}

interface Student {
  id: string;
  email: string;
  displayName: string;
}

const AcademicRecords: React.FC<{ 
  initialStudentId?: string;
  onNavigate?: (view: string) => void;
}> = ({ initialStudentId, onNavigate }) => {
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin' | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!auth.currentUser || !auth.currentUser.email) return;
      try {
        const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', auth.currentUser.email)));
        if (!userDoc.empty) {
          const role = userDoc.docs[0].data().role;
          setUserRole(role);
          if (role === 'teacher' || role === 'admin') {
            let studentQuery;
            if (role === 'teacher') {
              studentQuery = query(
                collection(db, 'users'), 
                where('role', '==', 'student'),
                where('teacherId', '==', auth.currentUser.uid)
              );
            } else {
              studentQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            }
            
            const studentDocs = await getDocs(studentQuery);
            const studentList = studentDocs.docs.map(doc => {
              const data = doc.data() as any;
              return {
                id: doc.id,
                email: data.email,
                displayName: data.displayName || data.email
              };
            });
            setStudents(studentList);
            if (studentList.length > 0 && !initialStudentId) setSelectedStudentId(studentList[0].id);
          } else if (!initialStudentId) {
            setSelectedStudentId(auth.currentUser.uid);
          }
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
      }
    };
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;

    setLoading(true);
    const q = query(
      collection(db, 'student_records'),
      where('studentId', '==', selectedStudentId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudentRecord[];
      setRecords(recordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching academic records:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedStudentId]);

  const handlePrint = () => {
    window.print();
  };

  const ShareModal = ({ record }: { record: StudentRecord }) => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:bg-white print:p-0"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto print:border-none print:bg-white print:text-black print:max-h-none print:overflow-visible"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10 print:hidden">
          <h2 className="text-xl font-bold">Share Progress Report</h2>
          <button onClick={() => setShowShareModal(false)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="printable-report" className="p-8 space-y-8 print:p-0">
          {/* Official Header */}
          <div className="text-center space-y-2 border-b-2 border-emerald-500 pb-6">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-emerald-500 print:text-emerald-600">Official English Progress Report</h1>
            <div className="flex justify-center gap-4 text-sm text-zinc-400 print:text-zinc-600">
              <span>Student: {record.studentEmail}</span>
              <span>•</span>
              <span>Date: {record.createdAt.toDate().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 print:border-emerald-200">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">
                {record.type === 'reading' ? 'Accuracy' : 'CEFR Level'}
              </span>
              <span className="text-4xl font-black text-emerald-500">{record.overallLevel}</span>
              {record.examScore && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20 w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">Exam Score</span>
                  <span className="text-xl font-black text-emerald-400">{record.examScore}</span>
                </div>
              )}
            </div>
            
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {record.type === 'reading' ? 'Performance' : 'Key Strengths'}
                </h3>
                <p className="text-zinc-200 print:text-zinc-800 leading-relaxed">{record.strengths}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  {record.type === 'reading' ? 'Missed Words' : 'Areas for Growth'}
                </h3>
                <p className="text-zinc-200 print:text-zinc-800 leading-relaxed">{record.weaknesses}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-zinc-500">3-Step Improvement Plan</h3>
            <div className="grid grid-cols-1 gap-3">
              {record.improvementPlan.map((step, i) => (
                <div key={i} className="flex items-start gap-4 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800 print:bg-zinc-50 print:border-zinc-200">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-zinc-300 print:text-zinc-700 text-sm pt-1">{step.replace(/^\d+\.\s*/, '').trim()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Family Support Plan */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 space-y-4 print:bg-blue-50 print:border-blue-200">
            <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Family Support Plan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-bold text-blue-300 print:text-blue-700">Parental Advice:</h4>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 print:text-zinc-600">
                  <li>Encourage 15 mins of daily practice</li>
                  <li>Celebrate the {record.overallLevel} achievement</li>
                  <li>Focus on the "Strengths" mentioned above</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-blue-300 print:text-blue-700">Home Activities:</h4>
                <p className="text-zinc-400 print:text-zinc-600">
                  Try to incorporate English into daily routines like mealtime or bedtime stories to build confidence.
                </p>
              </div>
            </div>
          </div>

          {record.audioUrl && (
            <div className="bg-zinc-800/50 border border-zinc-800 rounded-3xl p-6 space-y-3 print:hidden">
              <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-500" />
                Listen to Assessment
              </h3>
              <audio src={record.audioUrl} controls className="w-full h-10" />
            </div>
          )}

          <div className="pt-8 border-t border-zinc-800 text-center text-xs text-zinc-500 print:text-zinc-400">
            Generated by AI CEFR Examiner • {new Date().toLocaleDateString()}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex gap-4 print:hidden">
          <button 
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl transition-all"
          >
            <Printer className="w-5 h-5" />
            Print / Save PDF
          </button>
          <button 
            onClick={() => {
              const text = `Check out my English Progress Report! CEFR Level: ${record.overallLevel}`;
              if (navigator.share) {
                navigator.share({
                  title: 'English Progress Report',
                  text: text,
                  url: window.location.href
                });
              } else {
                navigator.clipboard.writeText(text);
                alert("Report summary copied to clipboard!");
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-2xl transition-all"
          >
            <Share2 className="w-5 h-5" />
            Share Link
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Academic Records</h2>
          <p className="text-zinc-500 text-sm">
            {userRole === 'student' ? 'Your complete AI assessment history' : 'View student assessment history'}
          </p>
        </div>
        
        {(userRole === 'teacher' || userRole === 'admin') && (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl">
            <User className="w-5 h-5 text-zinc-500 ml-2" />
            <select 
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="bg-transparent border-none text-zinc-100 text-sm font-medium focus:ring-0 outline-none pr-8"
            >
              {students.map(s => (
                <option key={s.id} value={s.id} className="bg-zinc-900">{s.displayName}</option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
          <Award className="w-4 h-4" />
          {records.length} Assessments
        </div>

        {onNavigate && (
          <button 
            onClick={() => onNavigate('speaking')}
            className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 text-sm font-bold transition-colors"
          >
            <Mic className="w-4 h-4" />
            New Assessment
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl p-12 text-center space-y-6">
          <FileText className="w-12 h-12 text-zinc-700 mx-auto" />
          <div className="space-y-2">
            <h3 className="font-bold text-xl">No records found</h3>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              Complete your first speaking assessment to see your records here.
            </p>
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('speaking')}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-900/20"
            >
              Start Speaking Assessment
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {records.map((record) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-emerald-500/50 transition-all group cursor-pointer"
              onClick={() => setSelectedRecord(record)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Calendar className="w-6 h-6 text-zinc-500 group-hover:text-emerald-500" />
                  </div>
                  <div>
                    <div className="font-bold">{record.createdAt.toDate().toLocaleDateString()}</div>
                    <div className="text-xs text-zinc-500">
                      {record.type === 'reading' ? `Reading: ${record.passageTitle}` : `Speaking: ${record.toolId}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold">
                      {record.type === 'reading' ? 'Accuracy' : 'CEFR'}
                    </div>
                    <div className="text-xl font-black text-emerald-500">{record.overallLevel}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-zinc-100 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Record Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
                <h2 className="text-xl font-bold">Assessment Details</h2>
                <button onClick={() => setSelectedRecord(null)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm text-zinc-500">{selectedRecord.createdAt.toDate().toLocaleString()}</div>
                    <div className="text-2xl font-bold">
                      {selectedRecord.type === 'reading' ? `Reading: ${selectedRecord.passageTitle}` : 'Speaking Evaluation'}
                    </div>
                  </div>
                  <div className="bg-emerald-500/20 text-emerald-500 px-6 py-3 rounded-2xl font-black text-3xl">
                    {selectedRecord.overallLevel}
                  </div>
                </div>

                {selectedRecord.scores && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Accuracy', val: selectedRecord.scores.accuracy ?? selectedRecord.scores.grammar ?? 0 },
                      { label: 'Fluency', val: selectedRecord.scores.fluency ?? 0 },
                      { label: 'Intonation', val: selectedRecord.scores.intonation ?? selectedRecord.scores.pronunciation ?? 0 },
                      { label: 'Vocab', val: selectedRecord.scores.vocabulary ?? selectedRecord.scores.vocab ?? 0 },
                    ].map((s, i) => (
                      <div key={i} className="bg-zinc-800/50 p-3 rounded-2xl border border-zinc-800 text-center">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1">{s.label}</div>
                        <div className="text-lg font-bold text-emerald-500">{s.val}%</div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRecord.audioUrl && (
                  <div className="bg-zinc-800/30 p-6 rounded-3xl border border-zinc-800 space-y-3">
                    <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-emerald-500" />
                      Session Recording
                    </h3>
                    <audio 
                      src={selectedRecord.audioUrl} 
                      controls 
                      className="w-full h-10 rounded-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      {selectedRecord.type === 'reading' ? 'Performance' : 'Strengths'}
                    </h3>
                    <p className="text-zinc-200 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800">{selectedRecord.strengths}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase text-zinc-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      {selectedRecord.type === 'reading' ? 'Missed Words' : 'Weaknesses'}
                    </h3>
                    <p className="text-zinc-200 bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800">{selectedRecord.weaknesses}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase text-zinc-500">Improvement Plan</h3>
                  <div className="space-y-2">
                    {selectedRecord.improvementPlan.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 bg-zinc-800/30 p-4 rounded-xl border border-zinc-800">
                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-zinc-300 text-sm">{step.replace(/^\d+\.\s*/, '').trim()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowShareModal(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <Share2 className="w-5 h-5" />
                    Share with Family
                  </button>
                  <button 
                    onClick={() => setSelectedRecord(null)}
                    className="flex-1 py-4 text-zinc-500 hover:text-zinc-100 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && selectedRecord && (
          <ShareModal record={selectedRecord} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicRecords;
