import React, { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { db, collection, addDoc, serverTimestamp, auth, handleFirestoreError, OperationType, doc, updateDoc } from "../firebase";
import { format } from "date-fns";

interface Question {
  id: number;
  text: string;
  correctAnswer: string;
  points: number;
}

interface TestData {
  title: string;
  instructions: string;
  questions: Question[];
  activation_time: string;
  duration: number;
}

export default function TestCreator() {
  const [testData, setTestData] = useState<TestData>({
    title: "",
    instructions: "",
    questions: [{ id: 1, text: "", correctAnswer: "", points: 10 }],
    activation_time: new Date().toISOString().slice(0, 16),
    duration: 60
  });
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const saveTest = async () => {
    if (!testData.title.trim()) {
      alert("Please enter a test title.");
      return;
    }
    
    setIsSaving(true);
    setSuccess(null);
    try {
      await addDoc(collection(db, 'test_templates'), {
        ...testData,
        created_by: auth.currentUser?.email || "anonymous",
        status: "active",
        is_live: false,
        security_level: "High - Virtual Proctor Active",
        createdAt: serverTimestamp()
      });
      setSuccess("Test Scheduled and Published Successfully!");
      // Reset form
      setTestData({
        title: "",
        instructions: "",
        questions: [{ id: 1, text: "", correctAnswer: "", points: 10 }],
        activation_time: new Date().toISOString().slice(0, 16),
        duration: 60
      });
    } catch (error) {
      console.error("Failed to save test:", error);
      handleFirestoreError(error, OperationType.CREATE, 'test_templates');
    } finally {
      setIsSaving(false);
    }
  };

  const scheduleTest = async (testId: string, startTime: string, durationMinutes: number) => {
    try {
      await updateDoc(doc(db, 'test_templates', testId), {
        activation_time: new Date(startTime).toISOString(),
        is_live: false, // Remains false until the clock hits the time
        duration: durationMinutes,
        security_level: "High - Virtual Proctor Active"
      });
      alert(`Test scheduled for ${format(new Date(startTime), "PPP p")}`);
    } catch (error) {
      console.error("Failed to schedule test:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'test_templates');
    }
  };

  const addQuestion = () => {
    setTestData({
      ...testData,
      questions: [...testData.questions, { id: Date.now(), text: "", correctAnswer: "", points: 10 }]
    });
  };

  const removeQuestion = (id: number) => {
    if (testData.questions.length === 1) return;
    setTestData({
      ...testData,
      questions: testData.questions.filter(q => q.id !== id)
    });
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQs = [...testData.questions];
    (newQs[index] as any)[field] = value;
    setTestData({ ...testData, questions: newQs });
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100">
      <div className="border-b border-slate-100 pb-8 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Test Designer</h2>
          {success && (
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-bounce">
              {success}
            </div>
          )}
        </div>
        <input 
          className="text-4xl font-black w-full border-none focus:ring-0 placeholder:text-slate-200 text-slate-900" 
          placeholder="Test Title (e.g., Midterm Reading)"
          value={testData.title}
          onChange={(e) => setTestData({...testData, title: e.target.value})}
        />
        <textarea 
          className="w-full mt-4 border-none focus:ring-0 text-slate-500 font-medium resize-none" 
          placeholder="General Instructions for Students..."
          rows={2}
          value={testData.instructions}
          onChange={(e) => setTestData({...testData, instructions: e.target.value})}
        />
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
          <div>
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 block">Activation Time</label>
            <input 
              type="datetime-local"
              className="w-full px-4 py-3 bg-white rounded-xl border border-indigo-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={testData.activation_time}
              onChange={(e) => setTestData({...testData, activation_time: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 block">Duration (Minutes)</label>
            <input 
              type="number"
              className="w-full px-4 py-3 bg-white rounded-xl border border-indigo-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={testData.duration}
              onChange={(e) => setTestData({...testData, duration: parseInt(e.target.value) || 0})}
            />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {testData.questions.map((q, i) => (
          <div key={q.id} className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 relative group transition-all hover:shadow-xl hover:shadow-slate-200/50">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Question {i + 1}</span>
              <button 
                onClick={() => removeQuestion(q.id)}
                className="text-slate-300 hover:text-rose-500 transition-colors p-2"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <input 
              className="block w-full bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 focus:ring-0 font-bold text-lg text-slate-800 pb-2 outline-none transition-all" 
              placeholder="Enter the question text..."
              value={q.text}
              onChange={(e) => updateQuestion(i, 'text', e.target.value)}
            />
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Correct Answer (For AI Comparison)</label>
                <input 
                  className="w-full px-5 py-4 bg-white rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="The exact correct answer..."
                  value={q.correctAnswer}
                  onChange={(e) => updateQuestion(i, 'correctAnswer', e.target.value)}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Points</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-4 bg-white rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  value={q.points}
                  onChange={(e) => updateQuestion(i, 'points', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <button 
          onClick={addQuestion}
          className="flex items-center gap-3 text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-50 px-6 py-4 rounded-2xl transition-all border-2 border-dashed border-indigo-200 hover:border-indigo-400"
        >
          <Plus size={20} /> Add New Question
        </button>

        <button 
          onClick={saveTest} 
          disabled={isSaving}
          className="w-full md:w-auto bg-indigo-600 text-white px-10 py-5 rounded-[24px] font-black shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={20} />
          )}
          <span className="uppercase tracking-widest text-sm">Publish Test</span>
        </button>
      </div>
    </div>
  );
}
