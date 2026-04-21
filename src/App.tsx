/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Send, Crown, Palette, LogOut, X, Loader2, Users, Music, Sparkles, Edit2, CheckCircle, Trash2, Info, Mail, ExternalLink, Youtube, Instagram, Twitch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
const ApplyPage = lazy(() => import('./pages/ApplyPage'));
import { AppState, NewsPost, Participant, OperationType } from './types';
import { handleFirestoreError } from './utils/firestore';

const THEMES = [
  { id: 'orange', bg: 'from-orange-400 to-amber-500', name: 'Солнечный Оранжевый' },
  { id: 'blue', bg: 'from-blue-400 to-indigo-500', name: 'Океанский Синий' },
  { id: 'pink', bg: 'from-pink-400 to-rose-500', name: 'Яркий Розовый' },
  { id: 'purple', bg: 'from-purple-400 to-fuchsia-500', name: 'Королевский Пурпурный' },
  { id: 'green', bg: 'from-emerald-400 to-teal-500', name: 'Свежий Зеленый' },
];

export default function App() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a] z-50">
        <Loader2 className="w-12 h-12 text-white animate-spin opacity-50" />
      </div>
    }>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/apply" element={<ApplyPage />} />
      </Routes>
    </Suspense>
  );
}

function MainApp() {
  const [appState, setAppState] = useState<AppState>({ theme: 'orange', winnerPost: '' });
  const [news, setNews] = useState<NewsPost[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeTab, setActiveTab] = useState<'news' | 'participants' | 'about'>('news');
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsPost | null>(null);
  
  // Admin inputs
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPost, setNewPost] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newWinnerPost, setNewWinnerPost] = useState('');
  const [newWinnerImage, setNewWinnerImage] = useState('');
  const [newParticipant, setNewParticipant] = useState({ email: '', name: '', country: '', song: '', emoji: '', imageUrl: '' });
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === 'matvey.zingaliuk@gmail.com' || currentUser?.email === 'smilevision.contest@gmail.com');
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
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'appState/global');
    });

    // Listen to news
    const qNews = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubNews = onSnapshot(qNews, (snapshot) => {
      const posts: NewsPost[] = [];
      snapshot.forEach((doc) => {
        posts.push({ id: doc.id, ...doc.data() } as NewsPost);
      });
      setNews(posts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'news');
    });

    // Listen to participants
    const qParticipants = query(collection(db, 'participants'), orderBy('createdAt', 'asc'));
    const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
      const parts: Participant[] = [];
      snapshot.forEach((doc) => {
        parts.push({ id: doc.id, ...doc.data() } as Participant);
      });
      setParticipants(parts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'participants');
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
    if (!newPost.trim() || !newPostTitle.trim() || !isAdmin) return;
    
    setIsSubmitting(true);
    try {
      const postData: any = {
        title: newPostTitle.trim(),
        content: newPost.trim(),
        createdAt: serverTimestamp(),
      };
      if (newPostImage.trim()) {
        postData.imageUrl = newPostImage.trim();
      }
      await addDoc(collection(db, 'news'), postData);
      setNewPostTitle('');
      setNewPost('');
      setNewPostImage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'news');
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
      handleFirestoreError(error, OperationType.WRITE, 'appState/global');
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
      handleFirestoreError(error, OperationType.UPDATE, 'appState/global');
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'news', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `news/${id}`);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParticipant.name || !newParticipant.country || !newParticipant.song || !newParticipant.emoji || !isAdmin) return;
    
    setIsSubmitting(true);
    try {
      const participantData: any = {
        email: newParticipant.email || user?.email || '',
        name: newParticipant.name,
        country: newParticipant.country,
        song: newParticipant.song,
        emoji: newParticipant.emoji,
        status: 'approved',
        createdAt: serverTimestamp(),
      };
      if (newParticipant.imageUrl?.trim()) {
        participantData.imageUrl = newParticipant.imageUrl.trim();
      }
      await addDoc(collection(db, 'participants'), participantData);
      setNewParticipant({ email: '', name: '', country: '', song: '', emoji: '', imageUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'participants');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteParticipant = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'participants', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `participants/${id}`);
    }
  };

  const handleUpdateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant || !isAdmin) return;
    
    const participantId = editingParticipant.id;
    setIsSubmitting(true);
    try {
      const { id, ...data } = editingParticipant;
      await updateDoc(doc(db, 'participants', id), data);
      setEditingParticipant(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `participants/${participantId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveParticipant = async (id: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'participants', id), { status: 'approved' });
    } catch (error) {
      console.error('Error approving participant:', error);
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
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(59,130,246,0.2)_0%,transparent_70%)] rounded-full" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(234,179,8,0.2)_0%,transparent_70%)] rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(239,68,68,0.1)_0%,transparent_70%)] rounded-full" />
          </div>

          {/* Main Content */}
          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <img 
                src="https://image2url.com/r2/default/images/1773521301663-1df2f2d5-01b8-4ea6-9b26-a339a258d4f7.png" 
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
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)]"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto min-h-screen flex flex-col p-4 sm:p-8">
        {/* Header */}
        <header className="text-center mb-12 mt-4">
          <div className="flex justify-end mb-4">
            <Link to="/apply" className="glass-button px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-yellow-300" /> Подать заявку
            </Link>
          </div>
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

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 glass p-1.5 rounded-2xl sticky top-4 z-30 max-w-2xl mx-auto w-full">
          <button 
            onClick={() => setActiveTab('news')}
            className={`flex-1 py-3 px-1 sm:px-4 rounded-xl font-display text-xs sm:text-lg transition-all ${
              activeTab === 'news' ? 'bg-white/30 shadow-md text-white' : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            🔥 Новости
          </button>
          <button 
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-3 px-1 sm:px-4 rounded-xl font-display text-xs sm:text-lg transition-all ${
              activeTab === 'participants' ? 'bg-white/30 shadow-md text-white' : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            🎤 Участники
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-3 px-1 sm:px-4 rounded-xl font-display text-xs sm:text-lg transition-all ${
              activeTab === 'about' ? 'bg-white/30 shadow-md text-white' : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            ℹ️ О нас
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-8 pb-12">
          <AnimatePresence mode="wait">
            {activeTab === 'news' ? (
              <motion.div 
                key="news"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {news.length === 0 ? (
                  <div className="glass rounded-2xl p-12 text-center text-white/70 col-span-full">
                    Пока нет новостей. Ждем улыбок! 🌟
                  </div>
                ) : (
                  news.map((post) => (
                    <motion.div
                      key={post.id}
                      layout
                      className="glass rounded-3xl p-6 relative cursor-pointer hover:bg-white/10 transition-all duration-300 group flex flex-col"
                      onClick={() => setSelectedNews(post)}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {post.imageUrl && (
                        <div className="relative overflow-hidden rounded-2xl mb-5 shadow-lg aspect-video">
                          <img 
                            src={post.imageUrl} 
                            alt="News" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                      )}
                      <h3 className="text-2xl font-bold mb-3 text-white group-hover:text-blue-300 transition-colors">
                        {post.title || 'Новость'}
                      </h3>
                      <div className="text-lg leading-relaxed markdown-body line-clamp-3 overflow-hidden opacity-80 flex-1">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({node, ...props}) => <a {...props} className="text-blue-300 underline hover:text-blue-200" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />,
                            strong: ({node, ...props}) => <strong {...props} className="font-bold text-white" />,
                            em: ({node, ...props}) => <em {...props} className="italic text-white/90" />
                          }}
                        >
                          {post.content}
                        </ReactMarkdown>
                      </div>
                      
                      <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
                        <span className="text-xs opacity-50 font-mono">
                          {post.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-sm font-bold text-blue-300 group-hover:text-blue-200 transition-colors flex items-center gap-1">
                          Подробнее <ExternalLink className="w-4 h-4" />
                        </span>
                      </div>
                      
                      {isAdmin && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNews(post.id);
                          }}
                          className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors z-10"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : activeTab === 'participants' ? (
              <motion.div 
                key="participants"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {participants.filter(p => p.status === 'approved' || !p.status).length === 0 ? (
                  <div className="glass rounded-2xl p-12 text-center text-white/70 col-span-full">
                    Участники еще не добавлены.
                  </div>
                ) : (
                  participants.filter(p => p.status === 'approved' || !p.status).map((p) => (
                    <motion.div
                      key={p.id}
                      layout
                      className="glass rounded-3xl p-6 relative overflow-hidden flex flex-col items-center gap-4 text-center hover:bg-white/10 transition-all duration-300 group"
                    >
                      <div className="relative">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-32 h-32 object-cover rounded-full shadow-xl border-4 border-white/20 group-hover:border-white/40 transition-all" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-6xl bg-white/10 p-6 rounded-full shadow-inner flex items-center justify-center w-32 h-32">
                            {p.emoji}
                          </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 text-4xl drop-shadow-md">
                          {p.emoji}
                        </div>
                      </div>
                      
                      <div className="w-full">
                        <h4 className="font-display text-2xl mb-1 text-white">
                          {p.country}
                        </h4>
                        <p className="font-medium text-lg opacity-90 flex items-center justify-center gap-2">
                          <Users className="w-4 h-4 text-blue-300" /> {p.name}
                        </p>
                        <p className="text-sm opacity-75 flex items-center justify-center gap-2 mt-1">
                          <Music className="w-4 h-4 text-pink-300" /> {p.song}
                        </p>
                      </div>
                      
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteParticipant(p.id)}
                          className="absolute top-4 right-4 p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full transition-colors"
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
                key="about"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="glass rounded-3xl p-8 space-y-6">
                  <h3 className="font-display text-3xl flex items-center gap-3">
                    <Info className="w-8 h-8 text-blue-300" /> О конкурсе
                  </h3>
                  <div className="space-y-4 text-lg leading-relaxed opacity-90">
                    <p>
                      <strong>SmileVision Song Contest</strong> — это онлайн-шоу, вдохновлённое атмосферой Eurovision, созданное в <strong>Minecraft</strong>.
                    </p>
                    <div className="space-y-2">
                      <p>Здесь:</p>
                      <ul className="list-disc ml-6 space-y-1">
                        <li>участники представляют свои песни и номера</li>
                        <li>проходят выступления с камерной съёмкой и световым шоу</li>
                        <li>зрители голосуют и выбирают победителя</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p>Вас ждут:</p>
                      <ul className="list-disc ml-6 space-y-1">
                        <li>живые трансляции</li>
                        <li>уникальные сценические постановки</li>
                        <li>голосование в реальном времени</li>
                        <li>собственная режиссура и продакшн</li>
                      </ul>
                    </div>
                    <p className="font-bold text-blue-200">
                      SmileVision — это не просто конкурс. Это шоу.
                    </p>
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm opacity-80 mt-6">
                      <p className="font-bold mb-2">⚠️ ДИСКЛЕЙМЕР!!!</p>
                      <p>
                        SMILEVISION — это независимый фанатский арт-проект. Данный ресурс НЕ является официальным ресурсом конкурса «Евровидение» (Eurovision Song Contest), не аффилирован с EBU или национальными вещателями и носит исключительно развлекательный характер. Все права на оригинальный бренд принадлежат их законным владельцам.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-3xl p-8 space-y-6">
                  <h3 className="font-display text-3xl flex items-center gap-3">
                    <Mail className="w-8 h-8 text-pink-300" /> Контакты
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white/10 rounded-2xl">
                        <Mail className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">Email</p>
                        <a href="mailto:smilevision.contest@gmail.com" className="text-blue-300 hover:underline">smilevision.contest@gmail.com</a>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <a href="https://t.me/smilevision_official" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/10 transition-all">
                        <Send className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Telegram</span>
                      </a>
                      <a href="https://www.youtube.com/@FeelTheSmileSV" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/10 transition-all">
                        <Youtube className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-medium">YouTube</span>
                      </a>
                      <a href="https://www.instagram.com/smilevision.contest/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/10 transition-all">
                        <Instagram className="w-5 h-5 text-pink-500" />
                        <span className="text-sm font-medium">Instagram</span>
                      </a>
                      <a href="https://www.tiktok.com/@smilevision.official" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/10 transition-all">
                        <Music className="w-5 h-5 text-white" />
                        <span className="text-sm font-medium">TikTok</span>
                      </a>
                      <a href="https://www.twitch.tv/smilevisionofficial" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 glass rounded-2xl hover:bg-white/10 transition-all">
                        <Twitch className="w-5 h-5 text-purple-500" />
                        <span className="text-sm font-medium">Twitch</span>
                      </a>
                    </div>

                    <div className="pt-6">
                      <Link to="/apply" className="w-full glass-button py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-xl">
                        <Sparkles className="w-6 h-6 text-yellow-300" /> Стать участником
                      </Link>
                    </div>
                  </div>
                </div>
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
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      placeholder="Заголовок новости"
                      className="glass-input rounded-xl px-4 py-2 text-sm font-bold"
                      maxLength={100}
                    />
                    <input
                      type="text"
                      value={newPostImage}
                      onChange={(e) => setNewPostImage(e.target.value)}
                      placeholder="Ссылка на картинку (необязательно)"
                      className="glass-input rounded-xl px-4 py-2 text-sm"
                      maxLength={2000}
                    />
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="Введите текст (поддерживается Markdown)..."
                        className="glass-input w-full rounded-xl px-4 py-3 text-lg min-h-[100px] resize-y"
                        maxLength={2000}
                      />
                      <button 
                        type="submit"
                        disabled={isSubmitting || !newPost.trim() || !newPostTitle.trim()}
                        className="glass-button rounded-xl py-3 flex items-center justify-center disabled:opacity-50"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5 mr-2" /> Опубликовать</>}
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

                {/* Applications & Participants Management */}
                <section>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" /> Управление участниками
                  </h3>
                  
                  {editingParticipant ? (
                    <form onSubmit={handleUpdateParticipant} className="flex flex-col gap-3 glass p-4 rounded-2xl mb-4 border border-blue-400/30">
                      <h4 className="font-medium text-blue-200 mb-2">Редактирование участника</h4>
                      <input
                        type="email"
                        value={editingParticipant.email || ''}
                        onChange={(e) => setEditingParticipant({...editingParticipant, email: e.target.value})}
                        placeholder="Email"
                        className="glass-input w-full rounded-xl px-4 py-2"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingParticipant.country}
                          disabled
                          className="glass-input flex-1 rounded-xl px-4 py-2 opacity-50 cursor-not-allowed"
                          title="Страну изменить нельзя"
                        />
                        <input
                          type="text"
                          value={editingParticipant.emoji}
                          onChange={(e) => setEditingParticipant({...editingParticipant, emoji: e.target.value})}
                          placeholder="Эмодзи"
                          className="glass-input w-24 rounded-xl px-4 py-2 text-center text-xl"
                        />
                      </div>
                      <input
                        type="text"
                        value={editingParticipant.name}
                        disabled
                        className="glass-input w-full rounded-xl px-4 py-2 opacity-50 cursor-not-allowed"
                        title="Имя исполнителя изменить нельзя"
                      />
                      <input
                        type="text"
                        value={editingParticipant.song}
                        onChange={(e) => setEditingParticipant({...editingParticipant, song: e.target.value})}
                        placeholder="Название песни"
                        className="glass-input w-full rounded-xl px-4 py-2"
                      />
                      <input
                        type="text"
                        value={editingParticipant.imageUrl || ''}
                        onChange={(e) => setEditingParticipant({...editingParticipant, imageUrl: e.target.value})}
                        placeholder="Ссылка на картинку"
                        className="glass-input w-full rounded-xl px-4 py-2"
                      />
                      <div className="flex gap-2 mt-2">
                        <button 
                          type="button"
                          onClick={() => setEditingParticipant(null)}
                          className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          Отмена
                        </button>
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 py-2 rounded-xl bg-blue-500/40 hover:bg-blue-500/60 transition-colors flex items-center justify-center"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      {/* Pending Applications */}
                      {participants.filter(p => p.status === 'pending').length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-yellow-300">Новые заявки</h4>
                          {participants.filter(p => p.status === 'pending').map(p => (
                            <div key={p.id} className="glass p-3 rounded-xl flex flex-col gap-2 text-sm border border-yellow-400/30">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold">{p.name} <span className="font-normal opacity-70">({p.country})</span></p>
                                  <p className="opacity-80">{p.email}</p>
                                  <p className="opacity-80">Песня: {p.song || '—'}</p>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => handleApproveParticipant(p.id)} className="p-1.5 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-green-200" title="Одобрить">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingParticipant(p)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-200" title="Редактировать">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteParticipant(p.id)} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-200" title="Удалить">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Approved Participants */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-white/70">Одобренные участники</h4>
                        {participants.filter(p => p.status === 'approved' || !p.status).map(p => (
                          <div key={p.id} className="glass p-3 rounded-xl flex justify-between items-center text-sm">
                            <div>
                              <p className="font-bold">{p.name}</p>
                              <p className="opacity-70 text-xs">{p.country}</p>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => setEditingParticipant(p)} className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-200" title="Редактировать">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteParticipant(p.id)} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-200" title="Удалить">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* Add Participant (Manual) */}
                <section className="pt-4 border-t border-white/10">
                  <h3 className="text-sm font-medium mb-3 opacity-70">Добавить участника вручную</h3>
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

      {/* News Modal */}
      <AnimatePresence>
        {selectedNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedNews(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 relative scrollbar-hide"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedNews(null)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
              >
                <X className="w-6 h-6" />
              </button>

              {selectedNews.imageUrl && (
                <img 
                  src={selectedNews.imageUrl} 
                  alt="News" 
                  className="w-full h-64 object-cover rounded-2xl mb-6 shadow-xl" 
                  referrerPolicy="no-referrer" 
                />
              )}

              <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white pr-8">
                {selectedNews.title || 'Новость'}
              </h2>

              <div className="text-xl sm:text-2xl leading-relaxed markdown-body text-white">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({node, ...props}) => <a {...props} className="text-blue-300 underline hover:text-blue-200" target="_blank" rel="noopener noreferrer" />,
                    strong: ({node, ...props}) => <strong {...props} className="font-bold text-white" />,
                    em: ({node, ...props}) => <em {...props} className="italic text-white/90" />,
                    h1: ({node, ...props}) => <h1 {...props} className="text-3xl font-bold mb-4" />,
                    h2: ({node, ...props}) => <h2 {...props} className="text-2xl font-bold mb-3" />,
                    p: ({node, ...props}) => <p {...props} className="mb-4" />,
                    ul: ({node, ...props}) => <ul {...props} className="list-disc ml-6 mb-4" />,
                    ol: ({node, ...props}) => <ol {...props} className="list-decimal ml-6 mb-4" />,
                  }}
                >
                  {selectedNews.content}
                </ReactMarkdown>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center opacity-60 text-sm font-mono">
                <span>{selectedNews.createdAt?.toDate().toLocaleDateString()}</span>
                <span>{selectedNews.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

