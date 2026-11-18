import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Loader2, CheckCircle2, AlertTriangle, Image as ImageIcon, Mic, StopCircle, Paperclip } from 'lucide-react';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isFunctionCall?: boolean;
  status?: 'success' | 'error';
  filePreview?: string;
  fileType?: 'image' | 'audio';
  fileData?: { data: string, mimeType: string };
}

interface AssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterExpense: (expense: any) => void;
  userName: string;
  availableBalance: number;
}

export function AssistantDrawer({ isOpen, onClose, onRegisterExpense, userName, availableBalance }: AssistantDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `¡Hola, ${userName}! Soy tu asistente financiero. ¿En qué puedo ayudarte hoy? Puedes decirme cosas como "Gasté 500 en café hoy", subir una foto de un ticket o mandarme un audio.` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string, code?: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File, preview: string, type: 'image' | 'audio' } | null>(null);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    if (!isImage && !isAudio) {
      setError({ message: 'Por favor selecciona una imagen o un archivo de audio.' });
      return;
    }

    const preview = URL.createObjectURL(file);
    setSelectedFile({ file, preview, type: isImage ? 'image' : 'audio' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        const preview = URL.createObjectURL(audioBlob);
        setSelectedFile({ file, preview, type: 'audio' });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError({ message: 'No se pudo acceder al micrófono. Por favor verifica los permisos.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && !selectedFile && !isLoading) return;

    let fileData = undefined;
    if (selectedFile) {
      const base64 = await fileToBase64(selectedFile.file);
      fileData = {
        data: base64,
        mimeType: selectedFile.file.type
      };
    }

    const userMessage: Message = { 
      role: 'user', 
      content: input,
      filePreview: selectedFile?.preview,
      fileType: selectedFile?.type,
      fileData
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          userName,
          availableBalance,
          previousInteractionId: interactionId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = 'Ocurrió un error inesperado.';
        if (data.code === 429) errorMessage = 'He alcanzado mi límite de mensajes por ahora. Intenta de nuevo más tarde.';
        if (data.code === 503) errorMessage = 'El asistente está muy solicitado en este momento. Por favor, intenta de nuevo en un minuto.';
        
        setError({ message: data.error || errorMessage, code: data.code });
        setIsLoading(false);
        return;
      }

      const assistantMessage: Message = { role: 'assistant', content: data.content };
      setInteractionId(data.interactionId);
      
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          if (call.name === 'registerExpense') {
            onRegisterExpense(call.args);
            assistantMessage.isFunctionCall = true;
            assistantMessage.status = 'success';
          }
        }
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError({ message: 'Error de conexión con el servidor.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0b0b14] border-l border-white/10 z-[101] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#121220]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white">Asistente Inteligente</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">En línea</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                    msg.role === 'user' ? "bg-slate-800 text-slate-400" : "bg-purple-500/20 text-purple-400"
                  )}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="space-y-2">
                    {msg.filePreview && (
                      <div className="rounded-2xl overflow-hidden border border-white/10 mb-2">
                        {msg.fileType === 'image' ? (
                          <img src={msg.filePreview} alt="Upload" className="w-full h-auto max-h-48 object-cover" />
                        ) : (
                          <audio src={msg.filePreview} controls className="w-full h-10 bg-white/5" />
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-purple-600 text-white rounded-tr-none shadow-lg shadow-purple-900/20" 
                          : "bg-white/5 text-slate-200 rounded-tl-none border border-white/5"
                      )}>
                        {msg.content}
                      </div>
                    )}
                    {msg.isFunctionCall && msg.status === 'success' && (
                      <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-1">
                        <CheckCircle2 size={12} />
                        Gasto registrado con éxito
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex gap-4 mr-auto max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={16} />
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  </div>
                </div>
              )}
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="text-rose-500 shrink-0" size={18} />
                  <div>
                    <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-1">Error del Asistente</p>
                    <p className="text-sm text-rose-200/70 leading-relaxed">{error.message}</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-6 bg-[#121220] border-t border-white/5">
              {selectedFile && (
                <div className="mb-4 p-3 bg-white/5 rounded-xl flex items-center justify-between group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {selectedFile.type === 'image' ? (
                      <img src={selectedFile.preview} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <Mic size={20} />
                      </div>
                    )}
                    <span className="text-xs text-slate-400 truncate">{selectedFile.file.name}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-slate-400 transition-all"
                  title="Adjuntar ticket o audio"
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    isRecording 
                      ? "bg-rose-500 text-white animate-pulse" 
                      : "bg-white/5 hover:bg-white/10 text-slate-400"
                  )}
                  title="Mantén para grabar audio"
                >
                  {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                </button>
              </div>

              <form onSubmit={handleSend} className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  disabled={isLoading}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-white outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
              <p className="mt-4 text-[10px] text-center text-slate-500 font-medium">
                {isRecording ? "Grabando... suelta para finalizar" : "Adjunta un ticket o graba un audio para registrar gastos"}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
