import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Calendar, 
  Filter, 
  ChevronDown, 
  Mic, 
  BookOpen, 
  Shield, 
  FileText, 
  Download, 
  ArrowUpDown,
  User,
  Clock,
  Award,
  ExternalLink
} from 'lucide-react';
import { db, collection, query, where, getDocs, orderBy, Timestamp } from '../firebase';

interface Assessment {
  id: string;
  type: 'Speaking' | 'Reading' | 'Audit';
  studentId: string;
  studentName: string;
  timestamp: Timestamp;
  score?: number;
  cefr?: string;
  audioUrl?: string;
  details: any;
}

interface Student {
  uid: string;
  displayName: string;
  grade: string;
  section: string;
  uniqueId: string;
}

const StudentHistory: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Speaking' | 'Reading' | 'Audit'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    const fetchStudents = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      const studentData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student));
      setStudents(studentData);
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchHistory(selectedStudent.uid);
    }
  }, [selectedStudent]);

  const fetchHistory = async (studentId: string) => {
    setLoading(true);
    try {
      const allAssessments: Assessment[] = [];

      // 1. Fetch Audits
      const auditQ = query(collection(db, 'audits'), where('studentId', '==', studentId));
      const auditSnap = await getDocs(auditQ);
      auditSnap.docs.forEach(doc => {
        const data = doc.data();
        allAssessments.push({
          id: doc.id,
          type: 'Audit',
          studentId: data.studentId,
          studentName: data.studentName,
          timestamp: data.timestamp,
          score: data.score,
          details: data
        });
      });

      // 2. Fetch Azure Recordings (Speaking/Reading from AzureAssessments)
      const azureQ = query(collection(db, 'azure_recordings'), where('studentId', '==', studentId));
      const azureSnap = await getDocs(azureQ);
      azureSnap.docs.forEach(doc => {
        const data = doc.data();
        allAssessments.push({
          id: doc.id,
          type: data.testType as 'Speaking' | 'Reading',
          studentId: data.studentId,
          studentName: data.studentName,
          timestamp: data.timestamp,
          cefr: data.cefr,
          audioUrl: data.audioUrl,
          details: data
        });
      });

      // 3. Fetch Student Assessment Log (Reading from AuditHub)
      const logQ = query(collection(db, 'student_assessment_log'), where('studentId', '==', studentId));
      const logSnap = await getDocs(logQ);
      logSnap.docs.forEach(doc => {
        const data = doc.data();
        // Avoid duplicates if same data is in azure_recordings (unlikely but safe)
        if (!allAssessments.find(a => a.id === doc.id)) {
          allAssessments.push({
            id: doc.id,
            type: data.type as 'Speaking' | 'Reading',
            studentId: data.studentId,
            studentName: data.studentName,
            timestamp: data.timestamp || data.createdAt,
            score: data.scores?.overall || data.scores?.accuracy,
            details: data
          });
        }
      });

      setAssessments(allAssessments);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssessments = assessments
    .filter(a => filterType === 'all' || a.type === filterType)
    .sort((a, b) => {
      const timeA = a.timestamp?.toMillis() || 0;
      const timeB = b.timestamp?.toMillis() || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  const filteredStudents = students.filter(s => 
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.uniqueId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">Student History</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Consolidated Assessment Timeline</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Student Selector */}
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
            <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
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
                  <div className="text-left min-w-0">
                    <p className="font-black text-xs truncate">{student.displayName}</p>
                    <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">{student.grade}{student.section}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* History Timeline */}
        <div className="lg:col-span-3 space-y-6">
          {selectedStudent ? (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-4 rounded-3xl border border-white/5">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900">All Types</option>
                    <option value="Speaking" className="bg-slate-900">Speaking</option>
                    <option value="Reading" className="bg-slate-900">Reading</option>
                    <option value="Audit" className="bg-slate-900">Audit</option>
                  </select>
                </div>

                <button 
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"
                >
                  <ArrowUpDown className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-white uppercase tracking-widest">
                    {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                  </span>
                </button>

                <div className="ml-auto text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  {filteredAssessments.length} Records Found
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Loading History...</p>
                  </div>
                ) : filteredAssessments.length > 0 ? (
                  filteredAssessments.map((assessment) => (
                    <motion.div
                      key={assessment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-panel rounded-3xl p-6 hover:border-purple-500/30 transition-all group"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                            assessment.type === 'Speaking' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            assessment.type === 'Reading' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            'bg-purple-500/10 border-purple-500/20 text-purple-400'
                          }`}>
                            {assessment.type === 'Speaking' ? <Mic className="w-6 h-6" /> :
                             assessment.type === 'Reading' ? <BookOpen className="w-6 h-6" /> :
                             <Shield className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-black text-white tracking-tight">{assessment.type} Test</h3>
                              <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {assessment.timestamp?.toDate().toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {assessment.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {assessment.cefr && (
                                <span className="flex items-center gap-1 text-purple-400">
                                  <Award className="w-3 h-3" />
                                  CEFR: {assessment.cefr}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {assessment.score !== undefined && (
                            <div className="text-right">
                              <p className="text-2xl font-black text-white tracking-tighter">{assessment.score.toFixed(1)}</p>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Score</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {assessment.audioUrl && (
                              <a 
                                href={assessment.audioUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-slate-400 hover:text-white transition-all"
                                title="Play Recording"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-slate-400 hover:text-white transition-all">
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Details Preview */}
                      <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {assessment.type === 'Audit' ? (
                          <>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pronunciation Audit</p>
                              <p className="text-xs text-slate-300 line-clamp-2">{assessment.details.pronunciationMistakes}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Grammar Audit</p>
                              <p className="text-xs text-slate-300 line-clamp-2">{assessment.details.grammaticalMistakes}</p>
                            </div>
                          </>
                        ) : assessment.type === 'Speaking' ? (
                          <>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transcription</p>
                              <p className="text-xs text-slate-300 line-clamp-2 italic">"{assessment.details.transcription}"</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Feedback</p>
                              <p className="text-xs text-slate-300 line-clamp-2">{assessment.details.feedback}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accuracy</p>
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full" 
                                  style={{ width: `${assessment.details.scores?.accuracy || 0}%` }} 
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fluency</p>
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-blue-500 h-full" 
                                  style={{ width: `${assessment.details.scores?.fluency || 0}%` }} 
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="glass-panel rounded-[40px] py-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                      <Clock className="w-8 h-8 text-slate-600" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-white tracking-tight">No Records Found</h3>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">This student has no assessment history yet.</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-panel rounded-[40px] h-[500px] flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-purple-600/10 rounded-[40px] flex items-center justify-center border border-purple-500/20">
                <User className="w-10 h-10 text-purple-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tighter">Select a Student</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">
                  Choose a student from the list to view their consolidated assessment history and performance timeline.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHistory;
