import React, { useState } from "react";
import { Printer, Loader2, Sparkles, CheckCircle, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ReportExportManagerProps {
  selectedAssessments: any[];
  onClearSelection: () => void;
}

/**
 * Transformation Logic: AI Feedback -> Official Template
 * This function cleans the Gemini output for the printed page.
 */
function formatAIFeedbackForPrint(assessment: any) {
  const plan = Array.isArray(assessment.improvementPlan) 
    ? assessment.improvementPlan.join("\n") 
    : (assessment.improvementPlan || "");

  // Regex to extract segments from the improvement_plan text
  const strengths = plan.match(/Strength: (.*?)(?=\n|$)/g) || [assessment.strengths || "Consistent effort"];
  const focusAreas = plan.match(/Focus: (.*?)(?=\n|$)/g) || [assessment.weaknesses || "Continue practicing daily"];

  return {
    student_name: assessment.studentName || assessment.studentEmail,
    student_id: assessment.studentId || "N/A",
    grade_level: assessment.gradeLevel || "N/A",
    overall_score: parseFloat(assessment.examScore || 0).toFixed(1),
    cefr_level: assessment.overallLevel,
    date: assessment.createdAt?.toDate ? assessment.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString(),
    grammar: assessment.scores?.accuracy || assessment.scores?.grammar || 0,
    fluency: assessment.scores?.fluency || 0,
    intonation: assessment.scores?.intonation || assessment.scores?.pronunciation || 0,
    vocabulary: assessment.scores?.vocabulary || assessment.scores?.vocab || 0,
    strengths_feedback_1: strengths[0]?.replace("Strength: ", "") || assessment.strengths || "Good vocabulary range",
    strengths_feedback_2: strengths[1]?.replace("Strength: ", "") || "Clear pronunciation",
    focus_area_1: focusAreas[0]?.replace("Focus: ", "") || assessment.weaknesses || "Work on sentence complexity",
    action_item_1: "Review weekly vocabulary lists",
    action_item_2: "Record and listen back to speaking tasks",
  };
}

export default function ReportExportManager({ selectedAssessments, onClearSelection }: ReportExportManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handlePrint = async () => {
    if (selectedAssessments.length === 0) return;
    
    setIsGenerating(true);
    
    try {
      const reports = selectedAssessments.map(a => formatAIFeedbackForPrint(a));
      console.log("Generating Reports for:", reports);
      
      // In this environment, we simulate the generation and open the print dialog
      // For a real production app, we would use something like @react-pdf/renderer
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        window.print();
      }, 1500);
      
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {selectedAssessments.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
        >
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-indigo-500/30 rounded-[32px] p-6 shadow-2xl shadow-indigo-500/20 flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
              <FileText className="text-indigo-400 w-7 h-7" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Report Generator</h3>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1">
                {selectedAssessments.length} assessments selected for bulk printing
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={onClearSelection}
                className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePrint}
                disabled={isGenerating}
                className={`flex items-center gap-3 px-8 py-4 ${showSuccess ? 'bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 min-w-[180px] justify-center`}
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : showSuccess ? (
                  <CheckCircle size={18} />
                ) : (
                  <Printer size={18} />
                )}
                {showSuccess ? "Ready to Print" : "Print Score Sheets"}
              </button>
            </div>
          </div>
          
          {/* Subtle AI Sparkle */}
          <div className="absolute -top-2 -right-2">
            <div className="relative">
              <Sparkles className="text-indigo-400 w-6 h-6 animate-pulse" />
              <div className="absolute inset-0 bg-indigo-400 blur-lg opacity-20 animate-pulse" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
