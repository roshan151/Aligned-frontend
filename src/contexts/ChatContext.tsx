import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatContextType {
  unifiedChatMessages: Message[];
  setUnifiedChatMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  unifiedChatHistory: any[];
  setUnifiedChatHistory: React.Dispatch<React.SetStateAction<any[]>>;
  hasUserSentMessage: boolean;
  setHasUserSentMessage: React.Dispatch<React.SetStateAction<boolean>>;
  chatHistoryRef: React.RefObject<HTMLDivElement>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unifiedChatMessages, setUnifiedChatMessages] = useState<Message[]>([]);
  const [unifiedChatHistory, setUnifiedChatHistory] = useState<any[]>([]);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to bottom when chat history changes
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [unifiedChatMessages]);

  const value = {
    unifiedChatMessages,
    setUnifiedChatMessages,
    unifiedChatHistory,
    setUnifiedChatHistory,
    hasUserSentMessage,
    setHasUserSentMessage,
    chatHistoryRef,
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