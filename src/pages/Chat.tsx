import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, User, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { config } from "../config/api";
import { Client as ConversationsClient } from '@twilio/conversations';

interface Message {
  sid: string;
  body: string;
  author: string;
  timestamp: Date;
  media?: {
    filename: string;
    contentType: string;
    size: number;
    url?: string;
  };
}

interface UserInfo {
  name: string;
  profilePicture?: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatClient, setChatClient] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-scroll function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };

  // Check if user is near bottom of chat
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    
    const container = messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    
    return (
      container.scrollTop + container.clientHeight >= 
      container.scrollHeight - threshold
    );
  };

  // Scroll to bottom only if user is near bottom (to not interrupt reading)
  const conditionalScrollToBottom = () => {
    if (isNearBottom()) {
      scrollToBottom();
    }
  };

  useEffect(() => {
    // First, try to use cached data from navigation state
    const cachedUserData = location.state as { userName?: string; userProfilePicture?: string } | null;
    
    if (cachedUserData?.userName) {
      setUserInfo({
        name: cachedUserData.userName,
        profilePicture: cachedUserData.userProfilePicture || null
      });
    }

    const fetchUserProfile = async () => {
      // Skip API fetch if we already have cached data
      if (cachedUserData?.userName && cachedUserData?.userProfilePicture) {
        return;
      }
      
      if (!uid) return;
      
      try {
        const response = await fetch(`${config.URL}${config.ENDPOINTS.GET_PROFILE}/${uid}`, {
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          
          setUserInfo({
            name: data.NAME || data.name || 'Unknown User',
            profilePicture: data.images && data.images.length > 0 ? data.images[0] : null
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Only set fallback if we don't have cached data
        if (!cachedUserData?.userName) {
          setUserInfo({
            name: 'Unknown User'
          });
        }
      }
    };

    const initializeChat = async () => {
      try {
        // Get current user's UID from localStorage
        const currentUserUID = localStorage.getItem('userUID');
        if (!currentUserUID) {
          throw new Error('Current user ID not found in localStorage');
        }
        if (!uid) {
          throw new Error('Target user ID not found in URL parameters');
        }

        // Get Twilio access token
        const tokenResponse = await fetch(`${config.URL}/e2echat:token/${currentUserUID}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          }
        });

        if (!tokenResponse.ok) {
          throw new Error(`Failed to get access token: ${tokenResponse.status}`);
        }
        const tokenData = await tokenResponse.json();
        const { token } = tokenData;

        // Get or create conversation
        const conversationResponse = await fetch(`${config.URL}/e2echat:conversation`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uid1: currentUserUID,
            uid2: uid
          })
        });

        if (!conversationResponse.ok) {
          throw new Error(`Failed to get conversation: ${conversationResponse.status}`);
        }
        const conversationData = await conversationResponse.json();
        console.log('Conversation API response:', conversationData);
        const { conversation_sid } = conversationData;
        console.log('Extracted conversation_sid:', conversation_sid);

        // Initialize Twilio Chat client
        let chatClient;
        try {
          console.log('Creating Twilio Conversations client...');
          chatClient = await ConversationsClient.create(token);
          console.log('Client created, connection state:', chatClient.connectionState);
          
          // Wait for the client to be fully initialized
          if (chatClient.connectionState !== 'connected') {
            console.log('Waiting for client to connect...');
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.error('Client connection timeout - this may be due to network restrictions');
                console.error('Please ensure these Twilio domains are accessible:');
                console.error('- chunderw-vpc-gll.twilio.com');
                console.error('- client.twilio.com');
                console.error('- media.twiliocdn.com');
                console.error('- media.twiliocloud.com');
                reject(new Error('Client initialization timeout - check network connectivity and firewall settings'));
              }, 15000); // Increased to 15 seconds
              
              chatClient.on('stateChanged', (state) => {
                console.log('Client state changed to:', state);
                if (state === 'connected') {
                  console.log('Client successfully connected!');
                  clearTimeout(timeout);
                  resolve(true);
                }
              });
              
              chatClient.on('connectionError', (error) => {
                console.error('Connection error:', error);
                clearTimeout(timeout);
                reject(new Error(`Connection failed: ${error.message}`));
              });
              
              // If already connected, resolve immediately
              if (chatClient.connectionState === 'connected') {
                console.log('Client already connected!');
                clearTimeout(timeout);
                resolve(true);
              }
            });
          } else {
            console.log('Client already connected!');
          }
          
          setChatClient(chatClient);
        } catch (error) {
          console.error("Chat initialization error:", error);
          if (error.message) console.error("Error message:", error.message);
          if (error.stack) console.error("Stack trace:", error.stack);
          if (error.body) console.error("Error body:", error.body); // Twilio-specific
          
          // Check if it's a network connectivity issue
          if (error.message.includes('timeout') || error.message.includes('Connection failed')) {
            throw new Error("Unable to connect to Twilio services. Please check your network connection and ensure Twilio domains are not blocked by firewall/VPN.");
          }
          
          throw new Error("Twilio ChatClient failed to initialize");
        }

        // Get conversation
        let conversation;
        try {
          // Get the conversation using the SID
          console.log('Attempting to get conversation with SID:', conversation_sid);
          conversation = await chatClient.getConversationBySid(conversation_sid);
          console.log('Successfully retrieved conversation:', conversation);
        } catch (error) {
          console.error('Error getting conversation:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            status: error.status
          });
          
          // If conversation doesn't exist, try to create a new one
          try {
            console.log('Attempting to create a new conversation...');
            conversation = await chatClient.createConversation({
              uniqueName: `chat_${currentUserUID}_${uid}`,
              friendlyName: `Chat between users`
            });
            
            // Add both users to the conversation
            await conversation.add(currentUserUID);
            await conversation.add(uid);
            
            console.log('Successfully created new conversation:', conversation);
          } catch (createError) {
            console.error('Error creating conversation:', createError);
            throw new Error(`Could not create or access conversation: ${createError.message}`);
          }
        }
        
        setConversation(conversation);
        
        // Debug: Show available methods on conversation
        console.log('Available conversation methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(conversation)));
        console.log('Conversation object:', conversation);

        // Set up message listener
        conversation.on('messageAdded', async (message: any) => {
          console.log('New message received:', message);
          console.log('Message attachedMedia:', message.attachedMedia);
          
          let mediaInfo = null;
          
          if (message.attachedMedia && message.attachedMedia.length > 0) {
            const media = message.attachedMedia[0];
            console.log('Processing media attachment:', media);
            
            try {
              const mediaUrl = await media.getContentTemporaryUrl();
              console.log('Media URL obtained:', mediaUrl);
              
              mediaInfo = {
                filename: media.filename || 'attachment',
                contentType: media.contentType || 'application/octet-stream',
                size: media.size || 0,
                url: mediaUrl
              };
              
              console.log('Final media info:', mediaInfo);
            } catch (error) {
              console.error('Error getting media URL:', error);
            }
          } else {
            console.log('No attached media found in message');
          }
          
          const newMessage = {
            sid: message.sid,
            body: message.body || '',
            author: message.author,
            timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
            media: mediaInfo
          };
          
          console.log('Adding message to state:', newMessage);
          
          // Prevent duplicate messages by checking if message already exists
          setMessages(prev => {
            const messageExists = prev.some(msg => msg.sid === message.sid);
            if (messageExists) {
              console.log('Message already exists, skipping:', message.sid);
              return prev;
            }
            return [...prev, newMessage];
          });
        });

        // Load existing messages
        const existingMessages = await conversation.getMessages();
        const processedMessages = await Promise.all(
          existingMessages.items.map(async (message: any) => {
            let mediaInfo = null;
            
            if (message.attachedMedia && message.attachedMedia.length > 0) {
              const media = message.attachedMedia[0];
              try {
                const mediaUrl = await media.getContentTemporaryUrl();
                mediaInfo = {
                  filename: media.filename || 'attachment',
                  contentType: media.contentType || 'application/octet-stream',
                  size: media.size || 0,
                  url: mediaUrl
                };
              } catch (error) {
                console.error('Error getting media URL:', error);
              }
            }
            
            return {
              sid: message.sid,
              body: message.body || '',
              author: message.author,
              timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
              media: mediaInfo
            };
          })
        );
        setMessages(processedMessages);

        setIsLoading(false);
      } catch (err) {
        console.error('Chat initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize chat');
        setIsLoading(false);
      }
    };

    fetchUserProfile();
    initializeChat();

    return () => {
      if (chatClient) {
        chatClient.shutdown();
      }
    };
  }, [uid]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !conversation || isSending) return;

    setIsSending(true);
    try {
      if (selectedFile) {
        console.log('Sending media file:', selectedFile);
        
        // Try different approaches for sending media
        try {
          // Method 1: Direct media parameter
          await conversation.sendMessage(newMessage.trim() || '', {
            media: selectedFile
          });
          console.log('Media sent using direct media parameter');
        } catch (error1) {
          console.log('Method 1 failed, trying method 2:', error1.message);
          
          try {
            // Method 2: Using FormData
            const formData = new FormData();
            formData.append('media', selectedFile);
            
            await conversation.sendMessage(newMessage.trim() || '', {
              media: formData
            });
            console.log('Media sent using FormData');
          } catch (error2) {
            console.log('Method 2 failed, trying method 3:', error2.message);
            
            try {
              // Method 3: Send as attachment
              const messageOptions = {
                body: newMessage.trim() || '',
                media: {
                  contentType: selectedFile.type,
                  filename: selectedFile.name,
                  media: selectedFile
                }
              };
              
              await conversation.sendMessage(messageOptions);
              console.log('Media sent using attachment format');
            } catch (error3) {
              console.log('Method 3 failed, trying method 4:', error3.message);
              
              // Method 4: Create message with media separately
              const message = await conversation.sendMessage(newMessage.trim() || 'Sent an image');
              console.log('Text message sent, now trying to attach media...');
              
              // This might not work, but let's see what methods are available
              console.log('Available message methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(message)));
              
              throw new Error('All media sending methods failed');
            }
          }
        }
        
        // Clear file selection
        setSelectedFile(null);
        setFilePreview(null);
      } else {
        // Send text message
        await conversation.sendMessage(newMessage);
      }
      
      setNewMessage("");
      
      // Auto-scroll to bottom after sending message
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
      console.error('Error details:', err.message, err.stack);
      setError('Failed to send message: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only images and videos are allowed');
      return;
    }

    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-red-500 rounded-full blur-lg opacity-50"></div>
            <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
            </div>
          </div>
          <p className="text-white/70 font-medium">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
          <CardContent className="p-6">
            <p className="text-red-400 text-center">{error}</p>
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="mt-4 w-full text-white/80 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_50%)]"></div>
      
      {/* Header */}
      <div className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-2xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center">
          <Button 
            onClick={() => navigate(-1)}
            variant="ghost" 
            className="text-white/80 hover:text-white hover:bg-white/10 mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center space-x-3">
            <Avatar className="w-14 h-14 ring-2 ring-white/20">
              {userInfo?.profilePicture ? (
                <AvatarImage src={userInfo.profilePicture} />
              ) : (
                <AvatarFallback className="bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold">
                  {userInfo?.name?.charAt(0) || <User className="w-6 h-6" />}
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-white amazon-font">
                {userInfo?.name || 'Loading...'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
          <CardContent className="p-6">
            <div 
              ref={messagesContainerRef}
              className="space-y-4 h-[calc(100vh-300px)] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.sid}-${index}-${message.timestamp.getTime()}`}
                  className={`flex ${message.author === localStorage.getItem('userUID') ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.author === localStorage.getItem('userUID')
                        ? 'bg-blue-500/20 text-blue-100'
                        : 'bg-white/10 text-white/90'
                    }`}
                  >
                    {(() => {
                      // Debug media message
                      if (message.media) {
                        console.log('Rendering media message:', message.media);
                      }
                      
                      return message.media ? (
                        <div className="space-y-2">
                          {message.media.contentType && message.media.contentType.startsWith('image/') ? (
                            <div className="relative">
                              {message.media.url ? (
                                <>
                                  <img 
                                    src={message.media.url} 
                                    alt={message.media.filename || 'Image'}
                                    className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{ maxHeight: '300px', minHeight: '100px' }}
                                    onLoad={() => {
                                      console.log('Image loaded successfully:', message.media.url);
                                      // Scroll to bottom when image loads
                                      setTimeout(scrollToBottom, 100);
                                    }}
                                    onError={(e) => {
                                      console.error('Image failed to load:', message.media.url);
                                      e.currentTarget.style.display = 'none';
                                    }}
                                    onClick={() => window.open(message.media.url, '_blank')}
                                  />
                                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                    {message.media.filename || 'Image'}
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                                  <p className="text-red-300 text-sm">Image URL not available</p>
                                  <p className="text-xs text-red-400 mt-1">{message.media.filename}</p>
                                </div>
                              )}
                            </div>
                          ) : message.media.contentType && message.media.contentType.startsWith('video/') ? (
                            <div className="relative">
                              {message.media.url ? (
                                <>
                                  <video 
                                    src={message.media.url} 
                                    controls
                                    className="max-w-full h-auto rounded-lg"
                                    style={{ maxHeight: '300px' }}
                                    onLoadedData={() => {
                                      // Scroll to bottom when video loads
                                      setTimeout(scrollToBottom, 100);
                                    }}
                                    onError={(e) => {
                                      console.error('Video failed to load:', message.media.url);
                                    }}
                                  />
                                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                    {message.media.filename || 'Video'}
                                  </div>
                                </>
                              ) : (
                                <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                                  <p className="text-red-300 text-sm">Video URL not available</p>
                                  <p className="text-xs text-red-400 mt-1">{message.media.filename}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 p-3 bg-white/10 rounded-lg border border-white/20">
                              <Paperclip className="w-5 h-5 text-white/60" />
                              <div>
                                <span className="text-sm text-white/90">{message.media.filename || 'Attachment'}</span>
                                <p className="text-xs text-white/60">
                                  {message.media.size ? `${(message.media.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                                </p>
                                <p className="text-xs text-white/60">
                                  Type: {message.media.contentType || 'Unknown'}
                                </p>
                                {!message.media.url && (
                                  <p className="text-xs text-red-400">URL not available</p>
                                )}
                              </div>
                            </div>
                          )}
                          {message.body && message.body.trim() && <p className="text-sm mt-2">{message.body}</p>}
                        </div>
                      ) : (
                        message.body && message.body.trim() && <p className="text-sm">{message.body}</p>
                      );
                    })()}
                    <p className="text-xs mt-1 opacity-60">
                      {(() => {
                        try {
                          const date = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
                          if (isNaN(date.getTime())) {
                            return 'Just now';
                          }
                          return date.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          });
                        } catch (error) {
                          return 'Just now';
                        }
                      })()}
                    </p>
                  </div>
                </div>
              ))}
              {/* Invisible element to scroll to */}
              <div ref={messagesEndRef} />
            </div>

            {/* File Preview */}
            {selectedFile && (
              <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/80">Selected file:</span>
                  <Button
                    onClick={handleRemoveFile}
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center space-x-3">
                  {filePreview ? (
                    <img 
                      src={filePreview} 
                      alt="Preview" 
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-white/10 rounded flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-white/60" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-white/90">{selectedFile.name}</p>
                    <p className="text-xs text-white/60">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="mt-4 flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={handleAttachClick}
                variant="outline"
                className="bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border-white/10"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white/90 placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
              <Button
                onClick={handleSendMessage}
                variant="outline"
                disabled={isSending}
                className="bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 hover:text-blue-100"
              >
                {isSending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-100"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Chat; 