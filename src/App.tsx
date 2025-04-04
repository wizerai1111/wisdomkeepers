import React, { useState, useEffect, useRef } from 'react';
import { Menu, AlertCircle, Info, HelpCircle, MessageSquare, LogIn, Mic, MicOff, X, Send, LogOut, Sun, Moon, Mic2, Lock, ArrowUp } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import logoImage from './assets/ChatGPT Image Apr 1, 2025, 08_37_53 PM.png';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { sendMessageToN8N, generateSpeech, getChatHistory } from './services/api';

type ModalType = 'about' | 'feedback' | 'signin' | 'signup' | 'chatHistory' | null;

interface Message {
  id?: string;
  text?: string;
  content?: string;
  isUser?: boolean;
  role?: 'user' | 'assistant';
  timestamp?: string | Date;
  audioUrl?: string;
}

export default function App(): JSX.Element {
  const { user, loading, signIn, signUp, signOut, resetPassword, updatePassword, verifyEmail } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<React.ReactNode | null>(null);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [sessionId, setSessionId] = useState<string>(Date.now().toString());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingPosition, setRecordingPosition] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(false);
  const [showLockIndicator, setShowLockIndicator] = useState(false);
  const [recordingAmplitude, setRecordingAmplitude] = useState(0);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelIndicator, setShowCancelIndicator] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const MAX_RECORDING_TIME = 120; // 2 minutes in seconds

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentAudio) {
      currentAudio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    }
  }, [currentAudio]);

  useEffect(() => {
    if (!hasShownWelcome) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        text: "**Please Note:** The Guru is not a therapist, counselor, or medical professional. The guidance offered comes from ancient texts and wisdom traditions, not modern therapeutic practice. For mental health concerns, please consult a qualified professional.\n\nWelcome to a space of reflection and ancient knowledge. Seek Wisdom, Not Advice\n\nOur Guru doesn't give advice but shares wisdom from sacred texts across traditions.",
        isUser: false,
        role: 'assistant',
        timestamp: new Date().toISOString()
      };
      setChatHistory([welcomeMessage]);
      setHasShownWelcome(true);
    }
  }, [hasShownWelcome]);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (user && activeModal === 'chatHistory') {
        setIsLoadingHistory(true);
        try {
          const history = await getChatHistory(sessionId);
          setHistoryMessages(history);
        } catch (error) {
          console.error('Error loading chat history:', error);
          setHistoryMessages([]); // Clear history on error
        } finally {
          setIsLoadingHistory(false);
        }
      }
    };
    loadChatHistory();
  }, [user, sessionId, activeModal]);

  const handleVoiceInput = (): void => {
    if (listening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });
      setIsListening(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Get the user ID from localStorage
      const userId = localStorage.getItem('userId') || 'anonymous';
      
      const response = await sendMessageToN8N({
        content: inputText,
        role: 'user',
        type: 'text',
        timestamp: new Date(),
        userId: userId
      });
      
      console.log('Received response from n8n:', response);

      if (response.text) {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          text: response.text,
          isUser: false,
          role: 'assistant',
          timestamp: new Date().toISOString()
        };
        setChatHistory(prev => [...prev, assistantMessage]);

        // Handle audio playback
        if (response.audioUrl) {
          const audio = new Audio(response.audioUrl);
          audio.onerror = (error) => {
            console.error('Error loading audio:', error);
          };
          setCurrentAudio(audio);
        }
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'I apologize, but I am having trouble connecting to the wisdom source. Please try again in a moment.',
        isUser: false,
        role: 'assistant',
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { data, error } = await signUp(email, password);
        
        if (error) {
          // Handle specific error cases
          if (error instanceof Error) {
            if (error.message.includes('email')) {
              setAuthError(
                <div className="text-red-500 text-sm">
                  There was an issue with the email. Please try again or use a different email address.
                </div>
              );
            } else if (error.message.includes('password')) {
              setAuthError(
                <div className="text-red-500 text-sm">
                  Password must be at least 6 characters long.
                </div>
              );
            } else if (error.message.includes('User already exists')) {
              setAuthError(
                <div className="text-red-500 text-sm">
                  An account with this email already exists. Please sign in instead.
                </div>
              );
              // Switch to sign in mode
              setIsSignUp(false);
            } else {
              setAuthError(
                <div className="text-red-500 text-sm">
                  {error.message}
                </div>
              );
            }
          } else {
            setAuthError(
              <div className="text-red-500 text-sm">
                An error occurred during sign up. Please try again.
              </div>
            );
          }
          return;
        }
        
        if (data?.user) {
          // Store user ID immediately after successful signup
          localStorage.setItem('userId', data.user.id);
          
          // Check if email confirmation is required
          if (!data.user.email_confirmed_at) {
            setAuthError(
              <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md text-sm">
                Please check your email to confirm your account. If you don't see the email, check your spam folder.
              </div>
            );
            
            // Set verification sent flag
            setIsVerificationSent(true);
            
            // Don't clear the form yet, let the user try to sign in if they've already confirmed
            return;
          }
          
          // If email is already confirmed, proceed with setting up the chat
          setChatHistory([
            {
              id: Date.now().toString(),
              text: "**Please Note:** The Guru is not a therapist, counselor, or medical professional. The guidance offered comes from ancient texts and wisdom traditions, not modern therapeutic practice. For mental health concerns, please consult a qualified professional.\n\nSeek Wisdom, Not Advice\n\nWelcome to a space of reflection and ancient knowledge. Our Guru doesn't give advice but shares wisdom from sacred texts across traditions.",
              isUser: false,
              role: 'assistant',
              timestamp: new Date().toISOString()
            },
            {
              id: (Date.now() + 1).toString(),
              text: "Welcome to GuruAI! I'm here to help you learn and grow. What would you like to explore today?",
              isUser: false,
              role: 'assistant',
              timestamp: new Date().toISOString()
            }
          ]);
          
          // Show success message
          setAuthError(
            <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">
              Your account has been created successfully! You can now sign in with your email and password.
            </div>
          );
          
          // Reset form and switch to sign in
          setEmail('');
          setPassword('');
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await signIn(email, password);
        if (error) {
          if (error instanceof Error) {
            if (error.message.includes('Email not confirmed')) {
              setAuthError(
                <div className="text-red-500 text-sm">
                  Please check your email to confirm your account before signing in.
                </div>
              );
              
              // Offer to resend verification email
              setAuthError(
                <div className="space-y-2">
                  <div className="text-red-500 text-sm">
                    Please check your email to confirm your account before signing in.
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await verifyEmail(email);
                        setAuthError(
                          <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">
                            Verification email sent! Please check your inbox.
                          </div>
                        );
                      } catch (err) {
                        setAuthError(
                          <div className="text-red-500 text-sm">
                            Failed to send verification email. Please try again later.
                          </div>
                        );
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Resend verification email
                  </button>
                </div>
              );
            } else if (error.message.includes('Invalid login credentials')) {
              setAuthError(
                <div className="text-red-500 text-sm">
                  Invalid email or password. Please try again.
                </div>
              );
            } else {
              setAuthError(
                <div className="text-red-500 text-sm">
                  {error.message}
                </div>
              );
            }
          } else {
            setAuthError(
              <div className="text-red-500 text-sm">
                An error occurred during sign in. Please try again.
          </div>
            );
          }
          return;
        }
        
        if (data?.user) {
          // Store user ID immediately after successful signin
          localStorage.setItem('userId', data.user.id);
          
          // Set the welcome message and add a welcome back message
          setChatHistory([
            {
              id: Date.now().toString(),
              text: "**Please Note:** The Guru is not a therapist, counselor, or medical professional. The guidance offered comes from ancient texts and wisdom traditions, not modern therapeutic practice. For mental health concerns, please consult a qualified professional.\n\nSeek Wisdom, Not Advice\n\nWelcome to a space of reflection and ancient knowledge. Our Guru doesn't give advice but shares wisdom from sacred texts across traditions.",
              isUser: false,
              role: 'assistant',
              timestamp: new Date().toISOString()
            },
            {
              id: (Date.now() + 1).toString(),
              text: "Welcome back! How can I assist you today?",
              isUser: false,
              role: 'assistant',
              timestamp: new Date().toISOString()
            }
          ]);
          
          // Close the modal after successful login
          setActiveModal(null);
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setAuthError(
        <div className="text-red-500 text-sm">
          An unexpected error occurred. Please try again later.
        </div>
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await resetPassword(email);
      setIsResetPassword(false);
      setActiveModal(null);
      setChatHistory(prev => [...prev, { 
        id: Date.now().toString(), 
        text: `I've sent a password reset email to ${email}. Please check your inbox and follow these steps:\n\n1. Open the email from Wisdom Keepers\n2. Click the "Reset Password" link\n3. Enter your new password\n4. Click "Update Password"\n\nIf you don't see the email, please check your spam folder.`, 
        isUser: false 
      }]);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    try {
      await updatePassword(newPassword);
      setActiveModal(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear all local state
      setChatHistory([
        {
          id: Date.now().toString(),
          text: "**Please Note:** The Guru is not a therapist, counselor, or medical professional. The guidance offered comes from ancient texts and wisdom traditions, not modern therapeutic practice. For mental health concerns, please consult a qualified professional.\n\nSeek Wisdom, Not Advice\n\nWelcome to a space of reflection and ancient knowledge. Our Guru doesn't give advice but shares wisdom from sacred texts across traditions.",
          isUser: false,
          role: 'assistant',
          timestamp: new Date().toISOString()
        },
        {
          id: (Date.now() + 1).toString(),
          text: "Thank you for spending time with us today. Your journey of self-discovery is valuable, and we hope you found moments of reflection and insight. We look forward to welcoming you back soon. Take care of yourself, and may your path be filled with wisdom and peace.",
          isUser: false,
          role: 'assistant',
          timestamp: new Date().toISOString()
        }
      ]);
      setInputText('');
      setHistoryMessages([]);
      setSessionId(Date.now().toString());
      setHasShownWelcome(true);
      
      // Clear localStorage
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      
      // Sign out from Supabase
      await signOut();
      
      // Close the menu
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice-note.webm');

        try {
          const response = await fetch('https://n8n.wizerai.com/webhook/voice-note', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to transcribe audio');
          }

          const data = await response.json();
          if (data.transcription) {
            setInputText(data.transcription);
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: 'Sorry, I had trouble transcribing your voice. Please try again or type your message.',
            timestamp: new Date().toISOString()
          }]);
        }

        // Clean up
        stream.getTracks().forEach(track => track.stop());
        setAudioChunks([]);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t access your microphone. Please check your permissions.',
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceSubmit = async (audioBlob: Blob) => {
    if (!user) return;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-note.webm');
      formData.append('userId', user.uid);
      formData.append('sessionId', sessionId);

      const response = await fetch('http://localhost:3001/api/voice-note', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add the transcribed text to chat
      if (data.transcription) {
        const newMessage: Message = {
          id: Date.now().toString(),
          text: data.transcription,
          sender: 'user',
          timestamp: new Date().toISOString()
        };
        setChatHistory(prev => [...prev, newMessage]);
      }

      // Add the assistant's response if available
      if (data.response) {
        const newMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: 'assistant',
          timestamp: new Date().toISOString()
        };
        setChatHistory(prev => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'Sorry, I had trouble processing your voice note. Please try again or type your message.',
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className={`flex flex-col h-screen ${theme === 'dark' ? 'bg-black' : 'bg-gray-100'}`}>
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => {
              setActiveModal('chatHistory');
            }}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-900 dark:hover:bg-gray-900"
            title="Chat History"
          >
            <MessageSquare className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex-1 text-center">∞ Wisdom Keepers</h1>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-900 dark:hover:bg-gray-900"
            title="Menu"
            >
            <Menu className="h-6 w-6" />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[calc(100vh-4rem)] px-4 sm:px-6 lg:px-8 py-2">
        <div className={`h-full chat-container rounded-2xl p-4 ${theme === 'dark' ? 'bg-black border-gray-800' : 'bg-white border-gray-200'} border shadow-lg`}>
          {/* Chat Interface */}
          <div className="h-full max-w-2xl mx-auto flex flex-col">
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {chatHistory.map((message) => (
                <div
                  key={message.id || Date.now().toString()}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.isUser 
                        ? theme === 'dark'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-900 text-gray-200' 
                          : 'bg-gray-200 text-gray-800'
                    }`}>
                    {(message.text || message.content || '').split('\n').map((part, index) => (
                      <p key={`${message.id}-${index}`} className="mb-2">
                        {part}
                      </p>
                    ))}
                    {message.audioUrl && (
                      <audio
                        controls
                        className="mt-2 w-full"
                        src={message.audioUrl}
                        onEnded={() => setCurrentAudio(null)}
                      />
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                rows={1}
              />
                <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                  className={`p-2 rounded-full ${
                  isRecording
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                title={isRecording ? "Recording... Release to stop" : "Hold to record"}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inputText.trim()}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
                </button>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden audio element for ElevenLabs voice */}
      <audio ref={audioRef} className="hidden" />

      {/* Menu Dropdown */}
      {isMenuOpen && (
        <div ref={menuRef} className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg ${theme === 'dark' ? 'bg-black border border-gray-800' : 'bg-white border border-gray-200'} ring-1 ring-black ring-opacity-5`}>
          <div className="py-1" role="menu" aria-orientation="vertical">
          <button
            onClick={() => {
              setActiveModal('about');
              setIsMenuOpen(false);
            }}
              className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
              role="menuitem"
          >
              About
          </button>
          <button
            onClick={() => {
              toggleTheme();
              setIsMenuOpen(false);
            }}
            className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'} flex items-center`}
            role="menuitem"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 mr-2" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 mr-2" />
                Dark Mode
              </>
            )}
          </button>
          {user ? (
            <button
              onClick={handleSignOut}
              className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
              role="menuitem"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => {
                setActiveModal('signin');
                setIsMenuOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
              role="menuitem"
            >
              Sign In
            </button>
          )}
          </div>
        </div>
      )}

      {/* Modals */}
      <Transition show={activeModal !== null} as={React.Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto"
          onClose={() => setActiveModal(null)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75" />
            </Transition.Child>

            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className={`inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform ${theme === 'dark' ? 'bg-black border-gray-800' : 'bg-white border-gray-200'} shadow-xl rounded-2xl border`}>
                {activeModal === 'about' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>About Us</h2>
                      <button
                        onClick={() => setActiveModal(null)}
                        className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className={`space-y-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      <p>
                        At Wisdom Keepers, we serve as a digital sanctuary where ancient wisdom meets modern seekers. Our platform illuminates spiritual perspectives across traditions without prescribing a singular path or offering direct guidance.
                      </p>
                      <p>
                        <strong>Our Purpose</strong>
                      </p>
                      <p>
                        We believe that spirituality is deeply personal. Rather than positioning ourselves as authorities or gurus, we curate and share the diverse experiences, insights, and practices that have resonated with seekers throughout history and across cultures.
                      </p>
                      <p>
                        Our name "Wisdom Keepers" reflects our commitment to preserving and sharing timeless spiritual insights while honoring the many voices and traditions that have carried wisdom through generations.
                      </p>
                      <p>
                        <strong>What We Offer</strong>
                      </p>
                      <p>
                        Wisdom Keepers presents:
                      </p>
                      <ul className="list-disc pl-5 mt-2 space-y-2">
                        <li>Curated collections of spiritual insights from diverse traditions</li>
                        <li>Personal narratives that illustrate different approaches to spiritual growth</li>
                        <li>Historical and contemporary examples of transformative practices</li>
                        <li>A judgment-free space to explore various perspectives on consciousness, purpose, and connection</li>
                      </ul>
                      <p>
                        <strong>Our Approach</strong>
                      </p>
                      <p>
                        We don't claim to have answers. Instead, we offer possibilities through the words and experiences of others. Whether you're beginning your spiritual journey or have been walking a path for decades, we hope the reflections shared here might spark recognition, inspiration, or new avenues of exploration.
                      </p>
                      <p>
                        Our platform exists not as a teacher but as a mirror - reflecting the multitude of ways humans have sought and found meaning throughout time.
                      </p>
                      <p>
                        <strong>Join the Journey</strong>
                      </p>
                      <p>
                        As you explore Wisdom Keepers, we invite you to approach each perspective with openness. Take what resonates, leave what doesn't, and know that the greatest spiritual wisdom often emerges from your own lived experience.
                      </p>
                    </div>
                  </div>
                )}
                
                {activeModal === 'chatHistory' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>Chat History</h2>
                      <button
                        onClick={() => setActiveModal(null)}
                        className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className={`space-y-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      {isLoadingHistory ? (
                        <p className="text-center">Loading chat history...</p>
                      ) : historyMessages.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto">
                          {historyMessages.map((message, index) => (
                            <div 
                              key={index}
                              className={`p-3 mb-2 rounded-lg ${message.isUser ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'} max-w-[80%] ${message.isUser ? 'ml-auto' : 'mr-auto'}`}
                            >
                              <p>{message.text}</p>
                              <p className="text-xs opacity-70 mt-1">{new Date(message.timestamp).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center">No chat history available yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeModal === 'signin' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                        {isSignUp ? 'Create Account' : 'Sign In'}
                      </h2>
                      <button
                        onClick={() => setActiveModal(null)}
                        className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <form onSubmit={handleAuth} className="space-y-4">
                      {authError && <div className="mt-2">{authError}</div>}
                      
                      <div>
                        <label 
                          htmlFor="email" 
                          className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                        >
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className={`mt-1 block w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                        />
                      </div>
                      
                      <div>
                        <label 
                          htmlFor="password" 
                          className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                        >
                          Password
                        </label>
                        <input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className={`mt-1 block w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
                        />
                      </div>
                      
                      <div className="flex justify-between">
                        <button
                          type="button"
                          onClick={() => setIsSignUp(!isSignUp)}
                          className={`text-sm ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                        >
                          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                        </button>
                      </div>
                      
                      <div>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          {isLoading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Recording UI */}
      {showRecordingUI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-64">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-gray-700 dark:text-gray-300">
                  {formatTime(recordingTime)}
                </span>
              </div>
              {showLockIndicator && (
                <div className="text-gray-700 dark:text-gray-300">
                  <Lock className="w-4 h-4" />
                </div>
              )}
            </div>
            <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-red-500"
                style={{
                  width: `${(recordingTime % 60) * (100 / 60)}%`,
                  transition: 'width 1s linear'
                }}
              />
            </div>
            {showCancelIndicator && (
              <div className="mt-2 text-center text-red-500">
                <ArrowUp className="w-6 h-6 mx-auto" />
                <span>Release to cancel</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}