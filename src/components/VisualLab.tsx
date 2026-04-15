import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  Sparkles, 
  FileText, 
  Search,
  BrainCircuit,
  X,
  Languages
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

const VisualLab: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAnalysis(null);
      setError(null);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(selectedImage);
      });
      const base64Data = await base64Promise;

      const prompt = `Act as an expert English teacher and visual linguist.
      Analyze this image and provide:
      1. A detailed description of what you see (in clear English).
      2. Key vocabulary words related to the image with their meanings.
      3. 3-5 practice questions for a student to answer about this image.
      4. If there is any text in the image (like a handwritten note or a sign), transcribe it and correct any English errors.
      
      Format your response with clear headings and bullet points.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: selectedImage.type
                }
              }
            ]
          }
        ]
      });

      setAnalysis(response.text);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze the image. Please try again with a different photo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Camera className="w-7 h-7 text-white" />
            </div>
            Visual English Lab
          </h1>
          <p className="text-zinc-500 font-bold mt-1">Analyze images, describe scenes, and transcribe visual text</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className="glass-panel rounded-[2.5rem] p-8 space-y-6">
            {!previewUrl ? (
              <div className="relative border-2 border-dashed border-white/10 rounded-[2rem] p-12 text-center hover:border-pink-500/50 hover:bg-pink-500/5 transition-all group cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-zinc-500 group-hover:text-pink-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-white">Upload or Drop Image</p>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">JPG, PNG, WEBP (Max 10MB)</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-[2rem] overflow-hidden border border-white/10 group">
                <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[500px] object-contain bg-black/40" />
                <button 
                  onClick={clearImage}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-500 text-white rounded-full transition-all backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <button 
              onClick={analyzeImage}
              disabled={!selectedImage || isAnalyzing}
              className="w-full py-5 bg-pink-500 hover:bg-pink-400 text-white font-black rounded-3xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-pink-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analyzing with Gemini Pro...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  Analyze Image
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
                <Search className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500" />
              Suggested Activities
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: FileText, text: "Transcribe handwritten homework" },
                { icon: ImageIcon, text: "Describe a complex scene" },
                { icon: Languages, text: "Identify objects in the image" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                  <item.icon className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-bold text-zinc-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-panel rounded-[2.5rem] p-8 h-full space-y-6 overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className="w-10 h-10 bg-pink-500/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-pink-500" />
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight">AI Analysis Report</h2>
                </div>
                <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              </motion.div>
            ) : (
              <div className="glass-panel rounded-[2.5rem] p-12 h-full flex flex-col items-center justify-center text-center space-y-6 opacity-50 border-dashed">
                <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/10">
                  <ImageIcon className="w-10 h-10 text-zinc-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white tracking-tight">No Analysis Yet</h3>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest max-w-[200px]">
                    Upload an image and click analyze to see the AI report.
                  </p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default VisualLab;
