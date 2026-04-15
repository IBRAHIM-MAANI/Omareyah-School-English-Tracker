import React, { useState } from "react";
import { Plus, Image as ImageIcon, Trash2, Save, Type, CheckSquare, HelpCircle, Loader2 } from "lucide-react";
import { db, collection, addDoc, serverTimestamp, auth, handleFirestoreError, OperationType, storage, ref, uploadBytes, getDownloadURL } from "../firebase";

interface Question {
  id: number;
  type: "mcq" | "tf" | "open_ended";
  text: string;
  options: string[];
  correctAnswer: string;
  imageUrl: string | null;
  points: number;
}

interface TestData {
  title: string;
  instructions: string;
  questions: Question[];
  activation_time: string;
  duration: number;
}

export default function AdvancedTestCreator() {
  const [testData, setTestData] = useState<TestData>({
    title: "",
    instructions: "",
    questions: [{ 
      id: Date.now(), 
      type: "mcq", 
      text: "", 
      options: ["", "", "", ""], 
      correctAnswer: "", 
      imageUrl: null,
      points: 10 
    }],
    activation_time: new Date().toISOString().slice(0, 16),
    duration: 60
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addQuestion = (type: "mcq" | "tf" | "open_ended") => {
    setTestData({
      ...testData,
      questions: [...testData.questions, { 
        id: Date.now(), 
        type, 
        text: "", 
        options: type === "mcq" ? ["", "", "", ""] : (type === "tf" ? ["True", "False"] : []),
        correctAnswer: "", 
        imageUrl: null,
        points: 10 
      }]
    });
  };

  const handleImageUpload = async (qIndex: number, file: File) => {
    if (!file) return;
    setIsUploading(qIndex);
    try {
      const storageRef = ref(storage, `test_assets/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const newQs = [...testData.questions];
      newQs[qIndex].imageUrl = url;
      setTestData({ ...testData, questions: newQs });
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(null);
    }
  };

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
      setSuccess("Advanced Test Published Successfully!");
      // Reset form
      setTestData({
        title: "",
        instructions: "",
        questions: [{ 
          id: Date.now(), 
          type: "mcq", 
          text: "", 
          options: ["", "", "", ""], 
          correctAnswer: "", 
          imageUrl: null,
          points: 10 
        }],
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

  return (
    <div className="max-w-5xl mx-auto p-10 bg-slate-50 min-h-screen rounded-[3rem]">
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Advanced Test Designer</h2>
          {success && (
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 animate-bounce">
              {success}
            </div>
          )}
        </div>
        <input 
          className="text-4xl font-black w-full border-none focus:ring-0 placeholder:text-slate-200 text-slate-900" 
          placeholder="New Advanced Assessment..."
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

      <div className="space-y-8 pb-32">
        {testData.questions.map((q, i) => (
          <div key={q.id} className="bg-white p-8 rounded-[2.5rem] shadow-md border border-slate-100 relative group transition-all hover:border-indigo-300">
            <div className="flex justify-between items-start mb-6">
               <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Question {i + 1} • {q.type.replace('_', ' ')}
               </span>
               <button 
                 onClick={() => setTestData({ ...testData, questions: testData.questions.filter((_, idx) => idx !== i) })} 
                 className="text-slate-300 hover:text-rose-500 transition-colors p-2"
               >
                  <Trash2 size={18} />
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
               <div className="space-y-4">
                  <textarea 
                    className="w-full p-5 bg-slate-50 border-none rounded-[2rem] text-sm font-medium focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
                    placeholder="Describe the question or prompt..."
                    value={q.text}
                    onChange={(e) => {
                      const newQs = [...testData.questions];
                      newQs[i].text = e.target.value;
                      setTestData({ ...testData, questions: newQs });
                    }}
                  />
                  
                  {!q.imageUrl ? (
                    <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 cursor-pointer hover:bg-slate-50 transition-all">
                      {isUploading === i ? (
                        <Loader2 className="animate-spin text-indigo-500" size={24} />
                      ) : (
                        <>
                          <ImageIcon size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Attach Reference Image</span>
                        </>
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(i, e.target.files[0])} />
                    </label>
                  ) : (
                    <div className="relative rounded-[2rem] overflow-hidden group shadow-lg">
                       <img src={q.imageUrl} className="w-full h-48 object-cover" />
                       <button onClick={() => {
                         const newQs = [...testData.questions];
                         newQs[i].imageUrl = null;
                         setTestData({ ...testData, questions: newQs });
                       }} className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                         <Trash2 size={16} />
                       </button>
                    </div>
                  )}
               </div>

               <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grading Anchor</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Points:</span>
                      <input 
                        type="number"
                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-indigo-600"
                        value={q.points}
                        onChange={(e) => {
                          const newQs = [...testData.questions];
                          newQs[i].points = parseInt(e.target.value) || 0;
                          setTestData({ ...testData, questions: newQs });
                        }}
                      />
                    </div>
                  </div>
                  
                  {q.type === 'mcq' && (
                    <div className="space-y-3">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex gap-3 items-center">
                          <input 
                            type="radio" 
                            name={`correct-${q.id}`} 
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            checked={q.correctAnswer === opt && opt !== ""}
                            onChange={() => {
                              const newQs = [...testData.questions];
                              newQs[i].correctAnswer = opt;
                              setTestData({ ...testData, questions: newQs });
                            }}
                          />
                          <input 
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                            placeholder={`Option ${optIdx + 1}`}
                            value={opt}
                            onChange={(e) => {
                               const newQs = [...testData.questions];
                               newQs[i].options[optIdx] = e.target.value;
                               setTestData({ ...testData, questions: newQs });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'tf' && (
                    <div className="flex gap-4 h-full items-center">
                      {["True", "False"].map(val => (
                        <button 
                          key={val}
                          onClick={() => {
                            const newQs = [...testData.questions];
                            newQs[i].correctAnswer = val;
                            setTestData({ ...testData, questions: newQs });
                          }}
                          className={`flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm ${q.correctAnswer === val ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'open_ended' && (
                    <textarea 
                      className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[150px]" 
                      placeholder="Enter the keywords or the full sentence AI should expect..."
                      value={q.correctAnswer}
                      onChange={(e) => {
                        const newQs = [...testData.questions];
                        newQs[i].correctAnswer = e.target.value;
                        setTestData({ ...testData, questions: newQs });
                      }}
                    />
                  )}
               </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/80 backdrop-blur-xl p-4 rounded-[3rem] shadow-2xl border border-slate-200 z-50">
        <button onClick={() => addQuestion('mcq')} className="flex items-center gap-2 px-5 py-3 hover:bg-indigo-50 rounded-full text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all">
          <CheckSquare size={18}/> MCQ
        </button>
        <button onClick={() => addQuestion('tf')} className="flex items-center gap-2 px-5 py-3 hover:bg-indigo-50 rounded-full text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all">
          <Type size={18}/> T/F
        </button>
        <button onClick={() => addQuestion('open_ended')} className="flex items-center gap-2 px-5 py-3 hover:bg-indigo-50 rounded-full text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all">
          <HelpCircle size={18}/> Writing
        </button>
        <div className="w-[1px] h-8 bg-slate-200 mx-2" />
        <button 
          onClick={saveTest} 
          disabled={isSaving}
          className="bg-indigo-600 text-white px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
        >
           {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
           PUBLISH ASSESSMENT
        </button>
      </div>
    </div>
  );
}
