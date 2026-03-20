import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle, AlertCircle, FileText, ChevronRight, Loader2, TrendingUp, Award } from 'lucide-react';
import { auth, db, collection, getDocs, query, where, Timestamp } from '../firebase';
import PronunciationTrainer from './PronunciationTrainer';
import { AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StudentPortal: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
  const [readingTests, setReadingTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTestForTrainer, setSelectedTestForTrainer] = useState<any | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchReadingTests = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'reading_tests'), 
          where('studentId', '==', auth.currentUser.uid),
          where('visibleToStudent', '==', true)
        );
        const snapshot = await getDocs(q);
        const tests = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
          } as any;
        });
        
        const sortedTests = tests.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        setReadingTests([...sortedTests].reverse());
        
        const data = sortedTests.map(t => ({
          date: t.createdAt.toLocaleDateString(),
          accuracy: t.accuracyScore,
          wpm: t.wpm
        }));
        setChartData(data);
      } catch (err) {
        console.error("Error fetching reading tests:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReadingTests();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-emerald-500">
          <BookOpen className="w-6 h-6" />
          <h2 className="text-xl font-bold">Reading Progress</h2>
        </div>
        
        <button 
          onClick={() => onNavigate?.('records')}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold transition-all group"
        >
          <Award className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          Academic Records
        </button>
      </div>

      {readingTests.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-zinc-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Performance History</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981' }}
                  activeDot={{ r: 6 }}
                  name="Accuracy %"
                />
                <Line 
                  type="monotone" 
                  dataKey="wpm" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                  name="WPM"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {readingTests.length === 0 ? (
        <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
          <BookOpen className="w-12 h-12 text-zinc-700" />
          <div className="max-w-xs space-y-1">
            <h3 className="text-lg font-bold">No Reading Tests Yet</h3>
            <p className="text-zinc-500 text-sm">
              Your teacher will assign and conduct reading tests here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {readingTests.map((test) => (
            <motion.div 
              key={test.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{test.passageTitle}</h3>
                  <p className="text-zinc-500 text-sm">{test.createdAt.toLocaleDateString()}</p>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-zinc-800"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={175.9}
                          strokeDashoffset={175.9 * (1 - test.accuracyScore / 100)}
                          className="text-emerald-500"
                        />
                      </svg>
                      <span className="absolute text-sm font-bold">{test.accuracyScore}%</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Accuracy</span>
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 flex items-center justify-center bg-zinc-800 rounded-full text-xl font-bold text-emerald-500">
                      {test.wpm}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">WPM</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Missed Words
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {test.missedWords.length > 0 ? (
                      test.missedWords.map((word: string, i: number) => (
                        <span key={i} className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-medium border border-red-500/20">
                          {word}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-500 text-sm italic">Perfect reading! No words missed.</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Improvement Plan
                  </h4>
                  <p className="text-zinc-300 text-sm bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700/50">
                    {test.improvementPlan || "Keep up the great work!"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <button 
                  onClick={() => setSelectedTestForTrainer(test)}
                  className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest"
                >
                  Pronunciation Trainer <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedTestForTrainer && (
          <PronunciationTrainer 
            missedWords={selectedTestForTrainer.missedWords}
            onClose={() => setSelectedTestForTrainer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentPortal;
