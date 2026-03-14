/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Send, Crown, Palette, LogOut, X, Loader2, Users, Music, Sparkles } from 'lucide-react';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

// Types
interface AppState {
  theme: string;
  winnerPost: string;
  winnerImage?: string;
}

interface NewsPost {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: any;
}

interface Participant {
  id: string;
  name: string;
  country: string;
  song: string;
  emoji: string;
  imageUrl?: string;
  createdAt: any;
}

const THEMES = [
  { id: 'orange', bg: 'from-orange-400 to-amber-500', name: 'Солнечный Оранжевый' },
  { id: 'blue', bg: 'from-blue-400 to-indigo-500', name: 'Океанский Синий' },
  { id: 'pink', bg: 'from-pink-400 to-rose-500', name: 'Яркий Розовый' },
  { id: 'purple', bg: 'from-purple-400 to-fuchsia-500', name: 'Королевский Пурпурный' },
  { id: 'green', bg: 'from-emerald-400 to-teal-500', name: 'Свежий Зеленый' },
];

export default function App() {
  const [appState, setAppState] = useState<AppState>({ theme: 'orange', winnerPost: '' });
  const [news, setNews] = useState<NewsPost[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeTab, setActiveTab] = useState<'news' | 'participants'>('news');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Admin inputs
  const [newPost, setNewPost] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newWinnerPost, setNewWinnerPost] = useState('');
  const [newWinnerImage, setNewWinnerImage] = useState('');
  const [newParticipant, setNewParticipant] = useState({ name: '', country: '', song: '', emoji: '', imageUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === 'matvey.zingaliuk@gmail.com');
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Loading screen timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Data listeners
  useEffect(() => {
    if (!isAuthReady) return;

    // Listen to appState
    const unsubState = onSnapshot(doc(db, 'appState', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setAppState(docSnap.data() as AppState);
      } else {
        // Initialize if not exists (only admin can write, but we handle default state in UI)
      }
    });

    // Listen to news
    const qNews = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubNews = onSnapshot(qNews, (snapshot) => {
      const posts: NewsPost[] = [];
      snapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() } as NewsPost);
      });
      setNews(posts);
    });

    // Listen to participants
    const qParticipants = query(collection(db, 'participants'), orderBy('createdAt', 'asc'));
    const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
      const parts: Participant[] = [];
      snapshot.forEach((doc) => {
        parts.push({ id: doc.id, ...doc.data() } as Participant);
      });
      setParticipants(parts);
    });

    return () => {
      unsubState();
      unsubNews();
      unsubParticipants();
    };
  }, [isAuthReady]);

  // Handle logo taps for secret admin access
  const handleLogoTap = () => {
    setLogoTaps((prev) => {
      const newTaps = prev + 1;
      if (newTaps >= 5) {
        if (!user) {
          handleLogin();
        } else if (isAdmin) {
          setShowAdminPanel(true);
        }
        return 0; // Reset
      }
      
      // Reset taps after 2 seconds of inactivity
      setTimeout(() => {
        setLogoTaps(0);
      }, 2000);
      
      return newTaps;
    });
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowAdminPanel(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const currentThemeObj = THEMES.find(t => t.id === appState.theme) || THEMES[0];

  // Admin Actions
  const handlePostNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !isAdmin) return;
    
    setIsSubmitting(true);
    try {
      const postData: any = {
        content: newPost,
        createdAt: serverTimestamp(),
      };
      if (newPostImage.trim()) {
        postData.imageUrl = newPostImage.trim();
      }
      await addDoc(collection(db, 'news'), postData);
      setNewPost('');
      setNewPostImage('');
    } catch (error) {
      console.error('Error posting news:', error);
      alert('Не удалось опубликовать новость.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWinnerPost.trim() || !isAdmin) return;
    
    setIsSubmitting(true);
    try {
      const stateUpdate: any = {
        ...appState,
        winnerPost: newWinnerPost,
      };
      if (newWinnerImage.trim()) {
        stateUpdate.winnerImage = newWinnerImage.trim();
      } else {
        // Remove image if empty
        const { winnerImage, ...rest } = stateUpdate;
        await setDoc(doc(db, 'appState', 'global'), rest);
        setNewWinnerPost('');
        setNewWinnerImage('');
        setIsSubmitting(false);
        return;
      }
      
      await setDoc(doc(db, 'appState', 'global'), stateUpdate, { merge: true });
      setNewWinnerPost('');
      setNewWinnerImage('');
    } catch (error) {
      console.error('Error setting winner:', error);
      alert('Не удалось выбрать победителя.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeTheme = async (themeId: string) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, 'appState', 'global'), {
        ...appState,
        theme: themeId,
      }, { merge: true });
    } catch (error) {
      console.error('Error changing theme:', error);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'news', id));
    } catch (error) {
      console.error('Error deleting news:', error);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipant.name || !newParticipant.country || !newParticipant.song || !newParticipant.emoji || !isAdmin) return;
    
    setIsSubmitting(true);
    try {
      const participantData: any = {
        name: newParticipant.name,
        country: newParticipant.country,
        song: newParticipant.song,
        emoji: newParticipant.emoji,
        createdAt: serverTimestamp(),
      };
      if (newParticipant.imageUrl?.trim()) {
        participantData.imageUrl = newParticipant.imageUrl.trim();
      }
      await addDoc(collection(db, 'participants'), participantData);
      setNewParticipant({ name: '', country: '', song: '', emoji: '', imageUrl: '' });
    } catch (error) {
      console.error('Error adding participant:', error);
      alert('Не удалось добавить участника.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteParticipant = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'participants', id));
    } catch (error) {
      console.error('Error deleting participant:', error);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {(!isAuthReady || isAppLoading) ? (
        <motion.div 
          key="loading"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0a] overflow-hidden"
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
        >
          {/* Background animated elements */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/10 rounded-full blur-3xl" />
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <img 
                src="https://i.ibb.co/fd6DBxyC/1000011571.png" 
                alt="SmileVision Logo" 
                className="w-64 md:w-96 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              />
            </motion.div>

            {/* Soundwave animation */}
            <div className="flex items-center justify-center gap-1.5 mt-12 h-12">
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 bg-white rounded-full"
                  initial={{ height: "20%" }}
                  animate={{ height: ["20%", "100%", "20%"] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>

            <motion.p 
              className="mt-8 text-white/70 font-medium tracking-[0.2em] uppercase text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
            >
              Настраиваем сцену...
            </motion.p>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className={`min-h-screen transition-colors duration-700 overflow-hidden relative font-sans`}
        >
          {/* Fixed background image to prevent mobile scroll repaint issues */}
          <div 
            className="fixed inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: `url('https://i.ibb.co/RpMXrZJ1/image.png')` }}
          />

          {/* Overlay for theme color to keep the dynamic feel but let the background show through */}
      <div className={`fixed inset-0 z-0 bg-gradient-to-br ${currentThemeObj.bg} opacity-40 pointer-events-none transition-colors duration-700`}></div>
      <div className={`fixed inset-0 z-0 bg-black/20 pointer-events-none`}></div>

      {/* Background decorative elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-md mx-auto min-h-screen flex flex-col p-6">
        {/* Header */}
        <header className="text-center mb-8 mt-4">
          <motion.div 
            className="inline-block cursor-pointer select-none"
            onClick={handleLogoTap}
            whileTap={{ scale: 0.95 }}
          >
            <img 
              src="https://image2url.com/r2/default/images/1773521301663-1df2f2d5-01b8-4ea6-9b26-a339a258d4f7.png" 
              alt="SmileVision Song Contest Moldova 2026" 
              className="w-64 md:w-80 mx-auto drop-shadow-xl"
              onError={(e) => {
                // Fallback if image isn't uploaded yet
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            {/* Fallback text logo if image is missing */}
            <div className="hidden">
              <h1 className="font-display text-5xl md:text-6xl tracking-wider text-white drop-shadow-lg flex flex-col items-center leading-none">
                <span className="flex items-center gap-2">
                  SMILE
                  <Heart className="w-10 h-10 fill-yellow-300 text-yellow-300" />
                  ISION
                </span>
                <span className="text-3xl md:text-4xl mt-1">SONG CONTEST</span>
              </h1>
              <p className="mt-2 text-lg font-medium opacity-90 tracking-widest uppercase">Moldova 2026</p>
            </div>
          </motion.div>
          
          <motion.h2 
            className="font-display text-4xl mt-6 text-white drop-shadow-lg"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            Feel the Smile!
          </motion.h2>
        </header>

        {/* Winner Announcement */}
        <AnimatePresence>
          {appState.winnerPost && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="mb-10 relative z-20"
            >
              <motion.div 
                className="glass rounded-[3rem] p-8 text-center relative overflow-hidden group shadow-lg border-yellow-300/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/20 via-white/5 to-yellow-500/20"></div>
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-yellow-300/20 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-400/20 rounded-full blur-2xl"></div>
                
                <div className="relative z-10">
                  <Crown className="w-20 h-20 mx-auto text-yellow-300 mb-4 drop-shadow-md" />
                </div>
                
                <h3 className="font-display text-3xl mb-4 text-yellow-100 uppercase tracking-widest flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                  Победитель
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                </h3>
                
                {appState.winnerImage && (
                  <motion.img 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    src={appState.winnerImage} 
                    alt="Winner" 
                    className="w-full h-64 object-cover rounded-3xl mb-6 shadow-2xl border-4 border-white/20 relative z-10" 
                    referrerPolicy="no-referrer" 
                  />
                )}
                
                <p className="text-6xl md:text-7xl drop-shadow-xl relative z-10">{appState.winnerPost}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 glass rounded-2xl">
          <button
            onClick={() => setActiveTab('news')}
            className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-display text-base sm:text-xl transition-all ${
              activeTab === 'news' ? 'bg-white/30 shadow-md text-white' : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            📰 Новости
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-display text-base sm:text-xl transition-all ${
              activeTab === 'participants' ? 'bg-white/30 shadow-md text-white' : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            🎤 Участники
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-4 pb-8">
          <AnimatePresence mode="wait">
            {activeTab === 'news' ? (
              <motion.div 
                key="news"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-4"
              >
                {news.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center text-white/70">
                    Пока нет новостей. Ждем улыбок! 🌟
                  </div>
                ) : (
                  news.map((post) => (
                    <motion.div
                      key={post.id}
                      layout
                      className="glass rounded-2xl p-5 relative"
                    >
                      {post.imageUrl && (
                        <img src={post.imageUrl} alt="News" className="w-full h-48 object-cover rounded-xl mb-4 shadow-md" referrerPolicy="no-referrer" />
                      )}
                      <p className="text-3xl leading-relaxed">{post.content}</p>
                      <span className="text-xs opacity-50 mt-3 block font-mono">
                        {post.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteNews(post.id)}
                          className="absolute top-2 right-2 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="participants"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 gap-4"
              >
                {participants.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center text-white/70">
                    Участники еще не добавлены.
                  </div>
                ) : (
                  participants.map((p) => (
                    <motion.div
                      key={p.id}
                      layout
                      className="glass rounded-2xl p-5 relative overflow-hidden flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-24 h-24 object-cover rounded-2xl shadow-md border-2 border-white/20" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-5xl bg-white/10 p-4 rounded-2xl shadow-inner flex items-center justify-center w-24 h-24">
                          {p.emoji}
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <h4 className="font-display text-2xl mb-1 flex items-center justify-center sm:justify-start gap-2">
                          {p.imageUrl && <span className="text-2xl">{p.emoji}</span>}
                          {p.country}
                        </h4>
                        <p className="font-medium text-lg flex items-center justify-center sm:justify-start gap-2 opacity-90">
                          <Users className="w-4 h-4" /> {p.name}
                        </p>
                        <p className="text-sm flex items-center justify-center sm:justify-start gap-2 opacity-75">
                          <Music className="w-4 h-4" /> {p.song}
                        </p>
                      </div>
                      
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteParticipant(p.id)}
                          className="absolute top-2 right-2 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && isAdmin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-display text-3xl flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-300" /> Панель управления
                </h2>
                <button 
                  onClick={() => setShowAdminPanel(false)}
                  className="p-2 glass-button rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Theme Selector */}
                <section>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Palette className="w-5 h-5" /> Тема приложения
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleChangeTheme(t.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          appState.theme === t.id 
                            ? 'bg-white text-black shadow-lg scale-105' 
                            : 'glass-button'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Post News */}
                <section>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Send className="w-5 h-5" /> Опубликовать новость
                  </h3>
                  <form onSubmit={handlePostNews} className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={newPostImage}
                      onChange={(e) => setNewPostImage(e.target.value)}
                      placeholder="Ссылка на картинку (необязательно)"
                      className="glass-input rounded-xl px-4 py-2 text-sm"
                      maxLength={2000}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="Введите текст или эмодзи..."
                        className="glass-input flex-1 rounded-xl px-4 py-3 text-2xl"
                        maxLength={500}
                      />
                      <button 
                        type="submit"
                        disabled={isSubmitting || !newPost.trim()}
                        className="glass-button rounded-xl px-4 flex items-center justify-center disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                  </form>
                </section>

                {/* Set Winner */}
                <section>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Crown className="w-5 h-5" /> Объявить победителя
                  </h3>
                  <form onSubmit={handleSetWinner} className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={newWinnerImage}
                      onChange={(e) => setNewWinnerImage(e.target.value)}
                      placeholder="Ссылка на картинку (необязательно)"
                      className="glass-input rounded-xl px-4 py-2 text-sm"
                      maxLength={2000}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newWinnerPost}
                        onChange={(e) => setNewWinnerPost(e.target.value)}
                        placeholder="Текст или эмодзи победителя..."
                        className="glass-input flex-1 rounded-xl px-4 py-3 text-xl"
                        maxLength={500}
                      />
                      <button 
                        type="submit"
                        disabled={isSubmitting || !newWinnerPost.trim()}
                        className="glass-button rounded-xl px-4 flex items-center justify-center disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Сохранить'}
                      </button>
                    </div>
                  </form>
                  {appState.winnerPost && (
                    <button 
                      onClick={async () => {
                        const { winnerPost, winnerImage, ...rest } = appState;
                        await setDoc(doc(db, 'appState', 'global'), rest);
                      }}
                      className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                    >
                      Убрать победителя
                    </button>
                  )}
                </section>

                {/* Add Participant */}
                <section>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" /> Добавить участника
                  </h3>
                  <form onSubmit={handleAddParticipant} className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newParticipant.country}
                        onChange={(e) => setNewParticipant({...newParticipant, country: e.target.value})}
                        placeholder="Страна"
                        className="glass-input flex-1 rounded-xl px-4 py-2"
                        maxLength={100}
                      />
                      <input
                        type="text"
                        value={newParticipant.emoji}
                        onChange={(e) => setNewParticipant({...newParticipant, emoji: e.target.value})}
                        placeholder="Эмодзи"
                        className="glass-input w-24 rounded-xl px-4 py-2 text-center text-xl"
                        maxLength={20}
                      />
                    </div>
                    <input
                      type="text"
                      value={newParticipant.name}
                      onChange={(e) => setNewParticipant({...newParticipant, name: e.target.value})}
                      placeholder="Имя артиста"
                      className="glass-input w-full rounded-xl px-4 py-2"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={newParticipant.song}
                      onChange={(e) => setNewParticipant({...newParticipant, song: e.target.value})}
                      placeholder="Название песни"
                      className="glass-input w-full rounded-xl px-4 py-2"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={newParticipant.imageUrl || ''}
                      onChange={(e) => setNewParticipant({...newParticipant, imageUrl: e.target.value})}
                      placeholder="Ссылка на картинку (необязательно)"
                      className="glass-input w-full rounded-xl px-4 py-2"
                      maxLength={2000}
                    />
                    <button 
                      type="submit"
                      disabled={isSubmitting || !newParticipant.name || !newParticipant.country || !newParticipant.song || !newParticipant.emoji}
                      className="glass-button rounded-xl py-3 flex items-center justify-center disabled:opacity-50 mt-1"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Добавить участника'}
                    </button>
                  </form>
                </section>

                {/* Logout */}
                <section className="pt-4 border-t border-white/20">
                  <button 
                    onClick={handleLogout}
                    className="w-full glass-button rounded-xl py-3 flex items-center justify-center gap-2 text-red-200 hover:text-red-100 hover:bg-red-500/20"
                  >
                    <LogOut className="w-5 h-5" /> Выйти
                  </button>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

