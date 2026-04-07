import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, Music, Send, User, Globe, Image as ImageIcon, ArrowLeft, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError } from '../utils/firestore';
import { OperationType } from '../types';
import { Link } from 'react-router-dom';

export default function ApplyPage() {
  const [applyForm, setApplyForm] = useState({ email: '', name: '', country: '', song: '', emoji: '', imageUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.email || !applyForm.name || !applyForm.country) return;
    
    setIsSubmitting(true);
    try {
      const participantData: any = {
        email: applyForm.email,
        name: applyForm.name,
        country: applyForm.country,
        song: applyForm.song,
        emoji: applyForm.emoji,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      if (applyForm.imageUrl?.trim()) {
        participantData.imageUrl = applyForm.imageUrl.trim();
      }
      await addDoc(collection(db, 'participants'), participantData);
      setApplySuccess(true);
      setApplyForm({ email: '', name: '', country: '', song: '', emoji: '', imageUrl: '' });
      setTimeout(() => setApplySuccess(false), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'participants');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center p-6 font-sans">
      <div className="fixed inset-0 z-0 bg-[url('https://i.ibb.co/RpMXrZJ1/image.png')] bg-cover bg-center opacity-20 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-2xl">
        <header className="mb-8 flex items-center justify-between">
          <Link to="/" className="glass-button p-3 rounded-full flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> На главную
          </Link>
          <img 
            src="https://image2url.com/r2/default/images/1773521301663-1df2f2d5-01b8-4ea6-9b26-a339a258d4f7.png" 
            alt="Logo" 
            className="w-32 drop-shadow-xl"
          />
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/20"
        >
          <h1 className="font-display text-3xl sm:text-4xl mb-6 text-center text-white drop-shadow-md">
            Подать заявку на участие
          </h1>
          
          {applySuccess ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-12"
            >
              <CheckCircle className="w-24 h-24 text-green-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
              <h2 className="text-2xl font-bold mb-2">Заявка успешно отправлена!</h2>
              <p className="text-white/70 text-lg">Ожидайте подтверждения администратором. Мы свяжемся с вами по email.</p>
              <Link to="/" className="mt-8 inline-block glass-button px-8 py-3 rounded-2xl font-medium">
                Вернуться на главную
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleApply} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                    <Send className="w-4 h-4" /> Ваш Email
                  </label>
                  <input
                    type="email"
                    required
                    value={applyForm.email}
                    onChange={(e) => setApplyForm({...applyForm, email: e.target.value})}
                    placeholder="example@mail.com"
                    className="glass-input w-full rounded-2xl px-5 py-4 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                    <User className="w-4 h-4" /> Сценическое имя
                  </label>
                  <input
                    type="text"
                    required
                    value={applyForm.name}
                    onChange={(e) => setApplyForm({...applyForm, name: e.target.value})}
                    placeholder="Как вас называть?"
                    className="glass-input w-full rounded-2xl px-5 py-4 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Страна
                  </label>
                  <input
                    type="text"
                    required
                    value={applyForm.country}
                    onChange={(e) => setApplyForm({...applyForm, country: e.target.value})}
                    placeholder="Какую страну представляете?"
                    className="glass-input w-full rounded-2xl px-5 py-4 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Эмодзи флага
                  </label>
                  <input
                    type="text"
                    required
                    value={applyForm.emoji}
                    onChange={(e) => setApplyForm({...applyForm, emoji: e.target.value})}
                    placeholder="Напр: 🇲🇩"
                    className="glass-input w-full rounded-2xl px-5 py-4 text-lg text-center"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <Music className="w-4 h-4" /> Название песни
                </label>
                <input
                  type="text"
                  required
                  value={applyForm.song}
                  onChange={(e) => setApplyForm({...applyForm, song: e.target.value})}
                  placeholder="Название вашего хита"
                  className="glass-input w-full rounded-2xl px-5 py-4 text-lg"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Ссылка на фото (необязательно)
                </label>
                <input
                  type="text"
                  value={applyForm.imageUrl}
                  onChange={(e) => setApplyForm({...applyForm, imageUrl: e.target.value})}
                  placeholder="https://image-url.com/photo.jpg"
                  className="glass-input w-full rounded-2xl px-5 py-4 text-lg"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full glass-button rounded-2xl py-5 text-xl font-bold flex items-center justify-center gap-3 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>Отправить заявку <Send className="w-6 h-6" /></>
                )}
              </button>
            </form>
          )}
        </motion.div>
        
        <footer className="mt-12 text-center text-white/50 text-sm">
          © 2026 SmileVision Song Contest Moldova. Все права защищены.
        </footer>
      </div>
    </div>
  );
}
