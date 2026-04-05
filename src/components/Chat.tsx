import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { generateChatResponse } from '../lib/gemini';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';

interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  assessedLevel?: string;
  createdAt: any;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;

    const fetchOrCreateProfile = async () => {
      const userRef = doc(db, 'users', userId);
      try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          const newProfile = {
            uid: userId,
            email: auth.currentUser?.email || '',
            displayName: auth.currentUser?.displayName || '',
            assessedLevel: 'Pending',
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      }
    };

    fetchOrCreateProfile();

    const messagesRef = collection(db, 'users', userId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
      
      // If no messages, send initial bot greeting
      if (msgs.length === 0 && !isLoading) {
        sendInitialGreeting();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/messages`);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendInitialGreeting = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const messagesRef = collection(db, 'users', userId, 'messages');
      await addDoc(messagesRef, {
        role: 'model',
        content: "Hello! I'm your English language assessor. Let's have a chat to determine your English level. To start, tell me a bit about yourself and why you want to learn English.",
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${userId}/messages`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !userId || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const messagesRef = collection(db, 'users', userId, 'messages');
      
      // Add user message
      await addDoc(messagesRef, {
        role: 'user',
        content: userMessage,
        createdAt: new Date().toISOString()
      });

      // Prepare history for Gemini
      const historyForGemini = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content
      })) as { role: 'user' | 'model', content: string }[];
      
      historyForGemini.push({ role: 'user', content: userMessage });

      // Get Gemini response
      const responseText = await generateChatResponse(historyForGemini);
      
      if (!responseText) {
        throw new Error("No response from Gemini");
      }

      // Check if response contains assessment JSON
      let finalContent = responseText;
      let assessmentData = null;
      
      const jsonMatch = responseText.match(/\`\`\`json\\n([\\s\\S]*?)\\n\`\`\`/);
      if (jsonMatch) {
        try {
          assessmentData = JSON.parse(jsonMatch[1]);
          finalContent = responseText.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.error("Failed to parse assessment JSON", e);
        }
      }

      // Add bot message
      if (finalContent) {
        await addDoc(messagesRef, {
          role: 'model',
          content: finalContent,
          createdAt: new Date().toISOString()
        });
      }

      // Update user profile if assessed
      if (assessmentData && assessmentData.assessment) {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
          assessedLevel: assessmentData.assessment
        }, { merge: true });
        
        // Add a system message with the feedback
        await addDoc(messagesRef, {
          role: 'system',
          content: `**Assessment Complete!**\n\n**Level:** ${assessmentData.assessment}\n\n**Feedback:** ${assessmentData.feedback}`,
          createdAt: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold">English Level Assessor</h2>
          <p className="text-indigo-100 text-sm">Chat naturally to discover your CEFR level</p>
        </div>
        {userProfile?.assessedLevel && userProfile.assessedLevel !== 'Pending' && (
          <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-sm">
            Level: {userProfile.assessedLevel}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={clsx(
                "max-w-[80%] rounded-2xl p-4 shadow-sm",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-br-none" 
                  : msg.role === 'system'
                    ? "bg-amber-100 text-amber-900 border border-amber-200 w-full rounded-2xl"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
              )}
            >
              <div className="flex items-center gap-2 mb-1 opacity-80 text-xs font-medium">
                {msg.role === 'user' ? (
                  <><User size={14} /> You</>
                ) : msg.role === 'system' ? (
                  <><Bot size={14} /> Assessment Result</>
                ) : (
                  <><Bot size={14} /> Assessor</>
                )}
              </div>
              <div className={clsx(
                "prose prose-sm max-w-none",
                msg.role === 'user' ? "prose-invert" : ""
              )}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 shrink-0">
        <div className="flex gap-2 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 text-white rounded-full p-3 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center justify-center aspect-square"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
