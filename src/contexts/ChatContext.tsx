import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  sessionId?: string; // Track which session this message belongs to
  type?: 'chat:app' | 'chat:user' | 'session-separator'; // Track message type
}

interface SessionData {
  messages: Message[];
  history: any[];
  hasUserSentMessage: boolean;
  sessionId: string;
  loginTimestamp: number;
}

interface UserChatData {
  [sessionId: string]: SessionData;
}

interface ChatContextType {
  unifiedChatMessages: Message[];
  setUnifiedChatMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  unifiedChatHistory: any[];
  setUnifiedChatHistory: React.Dispatch<React.SetStateAction<any[]>>;
  hasUserSentMessage: boolean;
  setHasUserSentMessage: React.Dispatch<React.SetStateAction<boolean>>;
  chatHistoryRef: React.RefObject<HTMLDivElement>;
  clearChatHistory: () => void;
  initializeUserSession: (userUID: string) => void;
  switchUser: (newUserUID: string) => void;
  addSessionSeparator: (type: 'login' | 'chat-type') => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUserUID, setCurrentUserUID] = useState<string>('');
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  
  // Generate session ID for current login
  const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Helper function to format date in "mmm - dd", hh:mm format
  const formatChatSeparatorDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const month = months[date.getMonth()];
    const day = date.getDate();
    const dayWithSuffix = day + (day % 10 === 1 && day !== 11 ? 'st' : 
                                day % 10 === 2 && day !== 12 ? 'nd' : 
                                day % 10 === 3 && day !== 13 ? 'rd' : 'th');
    
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${month} ${dayWithSuffix}, ${displayHours}:${minutes} ${ampm}`;
  };
  
  // Get user-specific storage key
  const getUserStorageKey = (userUID: string) => `destiny-chat-data-${userUID}`;
  
  // Load user's chat data from localStorage
  const loadUserChatData = (userUID: string): UserChatData => {
    try {
      const saved = localStorage.getItem(getUserStorageKey(userUID));
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Error loading user chat data from localStorage:', error);
      return {};
    }
  };
  
  // Save user's chat data to localStorage
  const saveUserChatData = (userUID: string, data: UserChatData) => {
    try {
      localStorage.setItem(getUserStorageKey(userUID), JSON.stringify(data));
    } catch (error) {
      console.error('Error saving user chat data to localStorage:', error);
    }
  };
  
  // Initialize state with current user's current session data
  const [unifiedChatMessages, setUnifiedChatMessages] = useState<Message[]>([]);
  const [unifiedChatHistory, setUnifiedChatHistory] = useState<any[]>([]);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // Initialize user session
  const initializeUserSession = (userUID: string) => {
    if (userUID === currentUserUID) return; // Already initialized for this user
    
    console.log(`Initializing chat session for user: ${userUID}`);
    
    // Save current session data if we have a current user
    if (currentUserUID && currentSessionId) {
      const currentUserData = loadUserChatData(currentUserUID);
      currentUserData[currentSessionId] = {
        messages: unifiedChatMessages,
        history: unifiedChatHistory,
        hasUserSentMessage,
        sessionId: currentSessionId,
        loginTimestamp: Date.now()
      };
      saveUserChatData(currentUserUID, currentUserData);
    }
    
    // Load new user's data
    const userData = loadUserChatData(userUID);
    const newSessionId = generateSessionId();
    
    // Combine all previous sessions messages for display
    const allPreviousMessages: Message[] = [];
    const sessionIds = Object.keys(userData).sort((a, b) => 
      userData[a].loginTimestamp - userData[b].loginTimestamp
    );
    
    sessionIds.forEach((sessionId, index) => {
      const sessionData = userData[sessionId];
      
      // Add session separator for previous sessions
      if (sessionData.messages.length > 0) {
        const sessionDate = new Date(sessionData.loginTimestamp);
        allPreviousMessages.push({
          text: formatChatSeparatorDate(sessionDate),
          isUser: false,
          timestamp: sessionDate,
          sessionId: sessionId,
          type: 'session-separator'
        });
        
        allPreviousMessages.push(...sessionData.messages);
      }
    });
    
    // Add current session separator if there are previous messages
    if (allPreviousMessages.length > 0) {
      const currentDate = new Date();
      allPreviousMessages.push({
        text: formatChatSeparatorDate(currentDate),
        isUser: false,
        timestamp: currentDate,
        sessionId: newSessionId,
        type: 'session-separator'
      });
    }
    
    setCurrentUserUID(userUID);
    setCurrentSessionId(newSessionId);
    setUnifiedChatMessages(allPreviousMessages);
    setUnifiedChatHistory([]);
    setHasUserSentMessage(false);
  };
  
  // Switch to different user (security: clear everything)
  const switchUser = (newUserUID: string) => {
    console.log(`Switching from user ${currentUserUID} to ${newUserUID}`);
    
    // Save current user's session data
    if (currentUserUID && currentSessionId) {
      const currentUserData = loadUserChatData(currentUserUID);
      currentUserData[currentSessionId] = {
        messages: unifiedChatMessages,
        history: unifiedChatHistory,
        hasUserSentMessage,
        sessionId: currentSessionId,
        loginTimestamp: Date.now()
      };
      saveUserChatData(currentUserUID, currentUserData);
    }
    
    // Clear current state completely for security
    setUnifiedChatMessages([]);
    setUnifiedChatHistory([]);
    setHasUserSentMessage(false);
    setCurrentUserUID('');
    setCurrentSessionId('');
    
    // Initialize new user
    initializeUserSession(newUserUID);
  };
  
  // Add session separator for different chat types
  const addSessionSeparator = (type: 'login' | 'chat-type') => {
    const currentDate = new Date();
    const separatorText = formatChatSeparatorDate(currentDate);
      
    const separator: Message = {
      text: separatorText,
      isUser: false,
      timestamp: currentDate,
      sessionId: currentSessionId,
      type: 'session-separator'
    };
    
    setUnifiedChatMessages(prev => [...prev, separator]);
  };

  // Persist current session data whenever messages change
  useEffect(() => {
    if (currentUserUID && currentSessionId && unifiedChatMessages.length > 0) {
      const userData = loadUserChatData(currentUserUID);
      userData[currentSessionId] = {
        messages: unifiedChatMessages,
        history: unifiedChatHistory,
        hasUserSentMessage,
        sessionId: currentSessionId,
        loginTimestamp: userData[currentSessionId]?.loginTimestamp || Date.now()
      };
      saveUserChatData(currentUserUID, userData);
    }
  }, [unifiedChatMessages, unifiedChatHistory, hasUserSentMessage, currentUserUID, currentSessionId]);

  // Effect to scroll to bottom when chat history changes
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [unifiedChatMessages]);

  // Function to clear chat history and user data (for logout)
  const clearChatHistory = () => {
    // Save current session before clearing
    if (currentUserUID && currentSessionId) {
      const userData = loadUserChatData(currentUserUID);
      userData[currentSessionId] = {
        messages: unifiedChatMessages,
        history: unifiedChatHistory,
        hasUserSentMessage,
        sessionId: currentSessionId,
        loginTimestamp: Date.now()
      };
      saveUserChatData(currentUserUID, userData);
    }
    
    // Clear current state
    setUnifiedChatMessages([]);
    setUnifiedChatHistory([]);
    setHasUserSentMessage(false);
    setCurrentUserUID('');
    setCurrentSessionId('');
    
    // Clear old sessionStorage items (legacy cleanup)
    try {
      sessionStorage.removeItem('destiny-chat-messages');
      sessionStorage.removeItem('destiny-chat-history');
      sessionStorage.removeItem('destinyUserHasChatted');
      sessionStorage.removeItem('destinyChatCompleted');
      sessionStorage.removeItem('destinyChatDismissed');
      
      // Clear ChatWithDestiny usage tracking for all users
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('destinyWindowChatUsed_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing legacy chat data from sessionStorage:', error);
    }
  };

  const value = {
    unifiedChatMessages,
    setUnifiedChatMessages,
    unifiedChatHistory,
    setUnifiedChatHistory,
    hasUserSentMessage,
    setHasUserSentMessage,
    chatHistoryRef,
    clearChatHistory,
    initializeUserSession,
    switchUser,
    addSessionSeparator,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}; 