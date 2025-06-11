import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { config } from "../config/api";

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatWithDestinyProps {
  userUID: string;
  onClose: () => void;
}

const ChatWithDestiny = ({ userUID, onClose }: ChatWithDestinyProps) => {
  console.log('ChatWithDestiny - Component initialized with userUID:', userUID);
  
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string>("");
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const popupTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize popup timer
  useEffect(() => {
    if (!userUID) {
      console.log('ChatWithDestiny - No userUID, not initializing chat');
      return;
    }

    console.log('ChatWithDestiny - Setting up popup timer');
    // Show popup after random time between 30-90 seconds
    const randomDelay = Math.floor(Math.random() * (90000 - 30000) + 30000);
    console.log('ChatWithDestiny - Timer set for:', randomDelay, 'ms');
    
    popupTimeoutRef.current = setTimeout(async () => {
      console.log('ChatWithDestiny - Timer completed, fetching initial message');
      try {
        const response = await fetch(`${config.URL}/chat:initiate/${userUID}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        const data = await response.json();
        
        if (data.message) {
          setInitialMessage(data.message);
          setIsPopupVisible(true);
        }
      } catch (error) {
        console.error('Error initiating chat:', error);
      }
    }, randomDelay);

    return () => {
      if (popupTimeoutRef.current) {
        console.log('ChatWithDestiny - Cleaning up timer');
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [userUID]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  const handlePopupClose = () => {
    console.log('ChatWithDestiny - Popup closed by user');
    setIsPopupVisible(false);
    // Store in sessionStorage that popup was dismissed
    sessionStorage.setItem('destinyChatDismissed', 'true');
    onClose();
  };

  const handleChatOpen = () => {
    setIsPopupVisible(false);
    setIsChatOpen(true);
    setIsLoading(true);

    // Add the initial message to the chat history
    if (initialMessage) {
      setMessages([{
        text: initialMessage,
        isUser: false,
        timestamp: new Date(),
      }]);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      text: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Create the metadata object
      const metadata = {
        uid: userUID,
        user_input: inputMessage,
        history: messages.map(msg => ({
          content: msg.text,
          role: msg.isUser ? "user" : "assistant"
        })),
        message: inputMessage,
        role: "user"
      };

      // Create FormData
      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));

      console.log('Sending chat request with data:', metadata);

      const response = await fetch(`${config.URL}/chat:continue`, {
        method: 'POST',
        body: formData
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('Chat response data:', data);
      
      if (data && data.message) {
        setMessages(prev => [...prev, {
          text: data.message,
          isUser: false,
          timestamp: new Date(),
        }]);
      } else {
        console.warn('No message in response:', data);
        setMessages(prev => [...prev, {
          text: "I received an empty response. Please try again.",
          isUser: false,
          timestamp: new Date(),
        }]);
      }

      if (data && data.continue === false) {
        handleChatClose();
      }
    } catch (error) {
      console.error('Detailed error in chat:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setMessages(prev => [...prev, {
        text: "I'm having trouble connecting right now. Please try again later.",
        isUser: false,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatClose = async () => {
    console.log('ChatWithDestiny - Chat closed by user');
    try {
      const formData = new FormData();
      const metadata = {
        uid: userUID,
        user_input: "exit",
        history: messages.map(msg => ({
          content: msg.text,
          role: msg.isUser ? "user" : "assistant"
        }))
      };
      formData.append('metadata', JSON.stringify(metadata));

      await fetch(`${config.URL}/chat:continue`, {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error('Error ending chat:', error);
    }

    setIsChatOpen(false);
    onClose();
    // Store in sessionStorage that chat was completed
    sessionStorage.setItem('destinyChatCompleted', 'true');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Add debug logging for render
  console.log('ChatWithDestiny - Rendering with state:', {
    isPopupVisible,
    isChatOpen,
    messages: messages.length,
    userUID
  });

  return (
    <>
      {/* Permanent D logo */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="w-36 h-36 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg">
          <span className="text-white text-6xl font-['Lavanderia']">D</span>
        </div>
      </div>

      <AnimatePresence>
        {isPopupVisible && (
          <motion.div
            initial={{ 
              opacity: 0, 
              x: 72, // Half of D logo width
              y: 72, // Half of D logo height
              scale: 0,
              transformOrigin: "right bottom",
              height: "144px" // Match D logo height
            }}
            animate={{ 
              opacity: 1, 
              x: 0, 
              y: 0,
              scale: 1,
              transformOrigin: "right bottom",
              height: "auto"
            }}
            exit={{ 
              opacity: 0, 
              x: 72,
              y: 72,
              scale: 0,
              transformOrigin: "right bottom",
              height: "144px" // Match D logo height
            }}
            transition={{ 
              type: "spring", 
              stiffness: 100, 
              damping: 15,
              duration: 0.5,
              height: { duration: 0.3 }
            }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="relative bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-2xl max-w-sm">
              <button
                onClick={handlePopupClose}
                className="absolute -top-2 -right-2 bg-indigo-700/20 hover:bg-indigo-700/30 rounded-full p-1 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex flex-col gap-2">
                <motion.p 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-white text-sm"
                >
                  {initialMessage}
                </motion.p>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={handleChatOpen}
                  className="text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  Reply
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ 
              opacity: 0, 
              scale: 0.95,
              x: 72, // Start from D logo position
              y: 72,
              transformOrigin: "right bottom"
            }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: 0,
              y: 0,
              transformOrigin: "right bottom"
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.95,
              x: 72,
              y: 72,
              transformOrigin: "right bottom"
            }}
            transition={{ 
              type: "spring", 
              stiffness: 100, 
              damping: 15,
              duration: 0.5
            }}
            className="fixed bottom-6 right-6 w-96 h-[500px] bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-indigo-500/20">
              <h3 className="text-4xl font-medium text-white font-['Lavanderia']">Destiny</h3>
              <button
                onClick={handleChatClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div ref={chatHistoryRef} className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        message.isUser
                          ? 'bg-indigo-500 text-white'
                          : 'bg-indigo-700/50 text-white'
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-indigo-700/50 text-white rounded-2xl px-4 py-2">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-indigo-500/20">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 bg-indigo-700/20 border-indigo-500/30 text-white placeholder:text-white/40"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatWithDestiny; 