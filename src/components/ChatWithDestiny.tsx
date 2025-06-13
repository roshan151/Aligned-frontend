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
  showChatWindow: boolean;
}

const ChatWithDestiny = ({ userUID, onClose, showChatWindow }: ChatWithDestinyProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (showChatWindow) {
      setIsChatOpen(true);
    }
  }, [showChatWindow]);

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
      const metadata = {
        uid: userUID,
        user_input: inputMessage
      };

      const response = await fetch("https://lovebhagya.com/chat:preference", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.message) {
        setMessages(prev => [...prev, {
          text: data.message,
          isUser: false,
          timestamp: new Date(),
        }]);

        // If this is the final message, mark chat as completed
        if (data.completed) {
          sessionStorage.setItem('destinyChatCompleted', 'true');
          setTimeout(() => {
            setIsChatOpen(false);
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prev => [...prev, {
        text: "I'm having trouble connecting right now. Please try again later.",
        isUser: false,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    setIsChatOpen(false);
    onClose();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={() => setIsChatOpen(true)}
        className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg"
      >
        <span className="text-4xl sm:text-6xl font-['Lavanderia']">D</span>
      </Button>

      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-32 right-0 bg-white rounded-lg shadow-xl w-80 sm:w-96"
          >
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-t-lg">
              <h3 className="font-['Lavanderia'] text-4xl">Destiny</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 hover:bg-indigo-500/20 text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <ScrollArea className="h-80 p-4">
              <div ref={chatHistoryRef} className="space-y-4 min-h-[280px]">
                {messages.length === 0 && (
                  <div className="flex flex-col justify-center items-center h-[280px]">
                    <p className="text-gray-500 text-lg font-medium">Hi!</p>
                    <p className="text-gray-500 text-lg font-medium">I'm Destiny</p>
                    <p className="text-gray-500 text-lg font-medium">Let's find your</p>
                    <p className="text-gray-500 text-lg font-medium">perfect match</p>
                  </div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.isUser
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.text}
                    </motion.div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-3 text-gray-900">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 text-gray-900 placeholder:text-gray-500"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatWithDestiny; 