import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Languages, 
  Copy, 
  Check, 
  Loader2, 
  Video, 
  FileVideo, 
  AlertCircle,
  Globe,
  Type,
  History,
  Image as ImageIcon,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LANGUAGES = [
  { code: 'Bengali', name: 'Bengali (বাংলা)' },
  { code: 'English', name: 'English' },
  { code: 'Hindi', name: 'Hindi (हिन्दी)' },
  { code: 'Spanish', name: 'Spanish (Español)' },
  { code: 'French', name: 'French (Français)' },
  { code: 'German', name: 'German (Deutsch)' },
  { code: 'Arabic', name: 'Arabic (العربية)' },
  { code: 'Japanese', name: 'Japanese (日本語)' },
  { code: 'Korean', name: 'Korean (한국어)' },
  { code: 'Portuguese', name: 'Portuguese (Português)' },
  { code: 'Russian', name: 'Russian (Русский)' },
  { code: 'Chinese', name: 'Chinese (中文)' },
];

const PRESET_WALLPAPERS = [
  { id: 'dark', name: 'Default Dark', url: '' },
  { id: 'abstract', name: 'Abstract Blue', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=1920' },
  { id: 'nature', name: 'Nature Mist', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1920' },
  { id: 'space', name: 'Deep Space', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1920' },
  { id: 'minimal', name: 'Minimal Gray', url: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?auto=format&fit=crop&q=80&w=1920' },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('Bengali');
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Wallpaper states
  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem('vidtrans-wallpaper') || '');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('vidtrans-wallpaper', wallpaper);
  }, [wallpaper]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setVideoUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': ['.mp4'], 'video/quicktime': ['.mov'], 'video/x-msvideo': ['.avi'], 'video/webm': ['.webm'] },
    multiple: false
  } as any);

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setWallpaper(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTranslate = async () => {
    if (!file) return;

    // Check file size (Limit to 100MB for browser stability)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_SIZE) {
      setError("ভিডিও ফাইলটি অনেক বড় (১০০ এমবি-র বেশি)। ব্রাউজারের সীমাবদ্ধতার কারণে দয়া করে ছোট সাইজের বা কম রেজোলিউশনের ভিডিও ব্যবহার করুন।");
      return;
    }

    setIsTranslating(true);
    setError(null);
    setProgress(10);

    try {
      // Convert file to base64 with memory consideration
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          } catch (e) {
            reject(new Error("ফাইলটি প্রসেস করার জন্য যথেষ্ট মেমোরি নেই। দয়া করে ছোট ভিডিও ট্রাই করুন।"));
          }
        };
        reader.onerror = () => reject(new Error("ফাইলটি পড়তে সমস্যা হয়েছে।"));
        reader.readAsDataURL(file);
      });
      
      setProgress(40);

      // Re-initialize AI inside the function to ensure fresh state
      const aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Please watch this video and provide a highly accurate translation of ONLY the spoken content into ${targetLanguage}.
        Do NOT include timestamps.
        Do NOT translate text on screen.
        Do NOT include any introductory or concluding remarks.
        Return ONLY the translated spoken text as clear, readable lines.
      `;

      const response = await aiInstance.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data
                }
              }
            ]
          }
        ]
      });

      if (!response.text) {
        throw new Error("AI কোনো ট্রান্সলেশন তৈরি করতে পারেনি। ভিডিওতে কথা পরিষ্কার আছে কি না চেক করুন।");
      }

      setProgress(90);
      setResult(response.text);
      setProgress(100);
    } catch (err: any) {
      console.error("Translation Error:", err);
      let friendlyMessage = "ট্রান্সলেশন করার সময় একটি সমস্যা হয়েছে।";
      
      if (err.message?.includes("quota")) {
        friendlyMessage = "আজকের ফ্রি লিমিট শেষ হয়ে গেছে। দয়া করে আগামীকাল আবার চেষ্টা করুন।";
      } else if (err.message?.includes("memory") || err.message?.includes("large")) {
        friendlyMessage = "ভিডিও ফাইলটি অনেক বড় হওয়ায় ব্রাউজার প্রসেস করতে পারছে না। ছোট ভিডিও ব্যবহার করুন।";
      } else if (err.message?.includes("API key")) {
        friendlyMessage = "API Key সংক্রান্ত সমস্যা। দয়া করে সেটিংস চেক করুন।";
      } else {
        friendlyMessage = err.message || friendlyMessage;
      }
      
      setError(friendlyMessage);
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      className="min-h-screen text-white font-sans selection:bg-blue-500/30 transition-all duration-500 bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ 
        backgroundColor: '#0a0a0a',
        backgroundImage: wallpaper ? `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${wallpaper})` : 'none'
      }}
    >
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Languages className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">VidTrans</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Wallpaper Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-white/60">
              <a href="#" className="hover:text-white transition-colors">How it works</a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Upload & Controls */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                Translate any video <br />
                <span className="text-blue-500">to any language.</span>
              </h2>
              <p className="text-lg text-white/60 max-w-md">
                Upload your video, select a target language, and get an accurate translation in seconds.
              </p>
            </div>

            <div className="space-y-6">
              {/* Dropzone */}
              <div 
                {...getRootProps()} 
                className={cn(
                  "relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
                  isDragActive ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/20 bg-white/5",
                  file ? "aspect-video" : "py-16"
                )}
              >
                <input {...getInputProps()} />
                
                {videoUrl ? (
                  <video 
                    src={videoUrl} 
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 px-6">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">ভিডিও এখানে ড্র্যাগ করুন বা ক্লিক করুন</p>
                      <p className="text-sm text-white/40">MP4, MOV, AVI (৩০ মিনিট পর্যন্ত সাপোর্ট করে)</p>
                      <p className="text-xs text-blue-400/60 mt-1">টিপস: বড় ভিডিওর ক্ষেত্রে রেজোলিউশন কমিয়ে ১০০ এমবি-র নিচে রাখুন</p>
                    </div>
                  </div>
                )}

                {file && !isTranslating && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setVideoUrl(null);
                      setResult(null);
                    }}
                    className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black rounded-full backdrop-blur-md transition-colors"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Controls */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Target Language
                  </label>
                  <select 
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code} className="bg-[#1a1a1a]">
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    disabled={!file || isTranslating}
                    onClick={handleTranslate}
                    className={cn(
                      "w-full h-[50px] rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95",
                      !file || isTranslating 
                        ? "bg-white/5 text-white/20 cursor-not-allowed" 
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                    )}
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Translating...
                      </>
                    ) : (
                      <>
                        <Type className="w-5 h-5" />
                        Start Translation
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Right Column: Result */}
          <div className="lg:sticky lg:top-28">
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col min-h-[500px] backdrop-blur-sm">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold">Translation Result</h3>
                    <p className="text-xs text-white/40 uppercase tracking-widest">Output in {targetLanguage}</p>
                  </div>
                </div>
                {result && (
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Text
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 p-6 relative">
                <AnimatePresence mode="wait">
                  {isTranslating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-6"
                    >
                      <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                        <motion.div 
                          className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold">{progress}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-bold">Processing Video...</p>
                        <p className="text-white/40 text-sm max-w-xs">
                          Our AI is analyzing the audio and visual content to provide the best translation.
                        </p>
                      </div>
                    </motion.div>
                  ) : result ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="prose prose-invert max-w-none"
                    >
                      <div className="whitespace-pre-wrap text-white/80 leading-relaxed font-mono text-sm">
                        {result}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white/20"
                    >
                      <FileVideo className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No translation yet</p>
                      <p className="text-sm">Upload a video and click translate to see the magic.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Wallpaper Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-500" /> Wallpaper Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <p className="text-sm font-bold uppercase tracking-widest text-white/40">Presets</p>
                  <div className="grid grid-cols-3 gap-3">
                    {PRESET_WALLPAPERS.map(wp => (
                      <button
                        key={wp.id}
                        onClick={() => setWallpaper(wp.url)}
                        className={cn(
                          "aspect-video rounded-xl border-2 transition-all overflow-hidden relative group",
                          wallpaper === wp.url ? "border-blue-500" : "border-transparent hover:border-white/20"
                        )}
                      >
                        {wp.url ? (
                          <img src={wp.url} className="w-full h-full object-cover" alt={wp.name} />
                        ) : (
                          <div className="w-full h-full bg-[#0a0a0a]" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] font-bold uppercase">{wp.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold uppercase tracking-widest text-white/40">Custom Wallpaper</p>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-white/40 mb-2" />
                      <p className="text-xs text-white/40">Upload your own image</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleWallpaperUpload} />
                  </label>
                </div>
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-white/10 flex justify-end">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 mt-12 bg-black/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Languages className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">VidTrans</span>
          </div>
          <p className="text-white/40 text-sm">
            © 2026 VidTrans AI. All rights reserved. Powered by Gemini.
          </p>
          <div className="flex gap-6 text-white/40 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
