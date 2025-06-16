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
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Helper function to detect correct content type
  const getCorrectContentType = (originalContentType: string, filename: string, url?: string): string => {
    console.log('getCorrectContentType called with:', { originalContentType, filename, url });
    
    if (originalContentType && originalContentType !== 'application/octet-stream') {
      console.log('Using original content type:', originalContentType);
      return originalContentType;
    }
    
    // Try to detect by filename extension first
    if (filename && filename !== 'attachment') {
      if (filename.match(/\.(jpg|jpeg)$/i)) {
        console.log('Detected JPEG from filename');
        return 'image/jpeg';
      } else if (filename.match(/\.png$/i)) {
        console.log('Detected PNG from filename');
        return 'image/png';
      } else if (filename.match(/\.gif$/i)) {
        console.log('Detected GIF from filename');
        return 'image/gif';
      } else if (filename.match(/\.webp$/i)) {
        console.log('Detected WebP from filename');
        return 'image/webp';
      }
    }
    
    // If filename detection fails, try URL detection
    if (url) {
      if (url.match(/\.(jpg|jpeg)(\?|$)/i)) {
        console.log('Detected JPEG from URL');
        return 'image/jpeg';
      } else if (url.match(/\.png(\?|$)/i)) {
        console.log('Detected PNG from URL');
        return 'image/png';
      } else if (url.match(/\.gif(\?|$)/i)) {
        console.log('Detected GIF from URL');
        return 'image/gif';
      } else if (url.match(/\.webp(\?|$)/i)) {
        console.log('Detected WebP from URL');
        return 'image/webp';
      }
    }
    
    // For Twilio media URLs or when we can't detect, assume it's an image
    // This is a reasonable assumption since we're in a chat context
    if (url && url.includes('twilio.com')) {
      console.log('Twilio media URL detected, defaulting to image/jpeg');
      return 'image/jpeg';
    }
    
    console.log('Defaulting to image/jpeg');
    return 'image/jpeg'; // Default for images
  };

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
        // Get current user's UID from localStorage with fallback options
        let currentUserUID = localStorage.getItem('userUID');
        
        // If userUID is not found, try to get it from userData
        if (!currentUserUID) {
          const userData = localStorage.getItem('userData');
          if (userData) {
            try {
              const parsedUserData = JSON.parse(userData);
              currentUserUID = parsedUserData.uid;
              console.log('Retrieved userUID from userData:', currentUserUID);
              
              // Store it back in userUID for future use
              if (currentUserUID) {
                localStorage.setItem('userUID', currentUserUID);
              }
            } catch (error) {
              console.error('Error parsing userData from localStorage:', error);
            }
          }
        }
        
        // Final check for userUID
        if (!currentUserUID) {
          console.error('Debug info - localStorage contents:');
          console.error('userUID:', localStorage.getItem('userUID'));
          console.error('userData:', localStorage.getItem('userData'));
          console.error('isLoggedIn:', localStorage.getItem('isLoggedIn'));
          const errorMsg = 'Current user ID not found in localStorage. Please try logging in again.';
          setAuthError(errorMsg);
          throw new Error(errorMsg);
        }
        
        if (!uid) {
          throw new Error('Target user ID not found in URL parameters');
        }
        
        console.log('Initializing chat with currentUserUID:', currentUserUID, 'targetUID:', uid);

        // Show UI immediately while initializing chat in background
        setIsInitializing(false);
        setIsLoading(false);

        // Make API calls in parallel for faster initialization
        const [tokenResponse, conversationResponse] = await Promise.all([
          fetch(`${config.URL}/e2echat:token/${currentUserUID}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            }
          }),
          fetch(`${config.URL}/e2echat:conversation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uid1: currentUserUID,
              uid2: uid
            })
          })
        ]);

        if (!tokenResponse.ok) {
          throw new Error(`Failed to get access token: ${tokenResponse.status}`);
        }
        if (!conversationResponse.ok) {
          throw new Error(`Failed to get conversation: ${conversationResponse.status}`);
        }

        const [tokenData, conversationData] = await Promise.all([
          tokenResponse.json(),
          conversationResponse.json()
        ]);

        const { token } = tokenData;
        const { conversation_sid } = conversationData;
        console.log('Got token and conversation_sid:', { token: !!token, conversation_sid });

        // Initialize Twilio Chat client with optimized timeout
        let chatClient;
        try {
          console.log('Creating Twilio Conversations client...');
          chatClient = await ConversationsClient.create(token);
          console.log('Client created, connection state:', chatClient.connectionState);
          
          // Wait for the client to be fully initialized with reduced timeout
          if (chatClient.connectionState !== 'connected') {
            console.log('Waiting for client to connect...');
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.warn('Client connection timeout - proceeding anyway');
                // Don't reject, just resolve and let the app continue
                resolve(true);
              }, 5000); // Reduced to 5 seconds for faster UX
              
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
                // Don't reject on connection error, let the app continue
                resolve(true);
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
          // Don't throw error, just log it and continue - user can still see the UI
          console.warn("Continuing with limited chat functionality");
        }

        // Get conversation (only if chatClient is available)
        let conversation;
        if (chatClient) {
          try {
            // Get the conversation using the SID
            console.log('Attempting to get conversation with SID:', conversation_sid);
            conversation = await chatClient.getConversationBySid(conversation_sid);
            console.log('Successfully retrieved conversation:', conversation);
          } catch (error) {
            console.error('Error getting conversation:', error);
            
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
              console.warn('Continuing without conversation - limited functionality');
            }
          }
          
          if (conversation) {
            setConversation(conversation);
            
            // Debug: Log available methods on conversation object
            console.log('Available conversation methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(conversation)));
            console.log('Conversation object:', conversation);
            
            // Check if there are any media-related methods
            const conversationMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(conversation));
            const mediaMethods = conversationMethods.filter(method => 
              method.toLowerCase().includes('media') || 
              method.toLowerCase().includes('attachment') ||
              method.toLowerCase().includes('file')
            );
            console.log('Media-related methods on conversation:', mediaMethods);
          }
        }
        
        // Set up message listener and load messages (only if conversation exists)
        if (conversation) {
          // Set up message listener with optimized processing
          conversation.on('messageAdded', async (message: any) => {
            console.log('New message received:', message);
            console.log('Message attachedMedia:', message.attachedMedia);
            console.log('Message media:', message.media);
            console.log('Full new message object:', message);
            console.log('New message body:', message.body);
            console.log('New message attributes:', message.attributes);
            console.log('All new message properties:', Object.keys(message));
            
            // Check if message has a state property with the actual data
            if (message.state) {
              console.log('Message state:', message.state);
              console.log('State body:', message.state.body);
              console.log('State attachedMedia:', message.state.attachedMedia);
              console.log('State media:', message.state.media);
            }
            
            // Check if message has other data properties
            if (message.data) {
              console.log('Message data:', message.data);
            }
            
            // Try to access message properties through getters
            try {
              console.log('Message.body getter:', message.body);
              console.log('Message.attachedMedia getter:', message.attachedMedia);
              console.log('Message.media getter:', message.media);
              console.log('Message.author getter:', message.author);
              console.log('Message.timestamp getter:', message.timestamp);
              console.log('Message.sid getter:', message.sid);
              
              // Try the specific media getter methods only if there's attached media
              if (message.attachedMedia && message.attachedMedia.length > 0 && typeof message.getTemporaryContentUrlsForAttachedMedia === 'function') {
                console.log('Trying getTemporaryContentUrlsForAttachedMedia...');
                const mediaSids = message.attachedMedia.map(media => media.sid).filter(sid => sid);
                if (mediaSids.length > 0) {
                  message.getTemporaryContentUrlsForAttachedMedia(mediaSids).then(urls => {
                    console.log('Attached media URLs:', urls);
                  }).catch(err => console.log('getTemporaryContentUrlsForAttachedMedia error:', err));
                }
              }
              
              if (typeof message.media === 'function') {
                console.log('Message.media is a function, calling it...');
                const mediaResult = message.media();
                console.log('Message.media() result:', mediaResult);
              }
              
            } catch (error) {
              console.error('Error accessing message getters:', error);
            }
            
            // Check what methods are available on the message object
            const messageMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(message));
            console.log('Available message methods:', messageMethods);
            
            // Look for getter methods
            const getterMethods = messageMethods.filter(method => 
              method.startsWith('get') || 
              method.includes('body') || 
              method.includes('media') || 
              method.includes('attachment')
            );
            console.log('Potential getter methods:', getterMethods);
            
            // Process media asynchronously to not block UI
            let mediaInfo = null;
            
            // Use the proper Twilio Conversations API getters
            console.log('Using Twilio getter methods for message data');
            console.log('Message attachedMedia:', message.attachedMedia);
            console.log('Message media:', message.media);
            
            // Try to get media using the proper API methods
            // First check if message has attachedMedia to get the SIDs
            if (message.attachedMedia && message.attachedMedia.length > 0 && typeof message.getTemporaryContentUrlsForAttachedMedia === 'function') {
              console.log('Getting media URLs using getTemporaryContentUrlsForAttachedMedia...');
              try {
                // Extract media SIDs from attachedMedia
                const mediaSids = message.attachedMedia.map(media => media.sid).filter(sid => sid);
                console.log('Media SIDs:', mediaSids);
                
                if (mediaSids.length > 0) {
                  const mediaUrls = await message.getTemporaryContentUrlsForAttachedMedia(mediaSids);
                  console.log('Got media URLs:', mediaUrls);
                  
                  if (mediaUrls && mediaUrls.length > 0) {
                                      const mediaUrl = mediaUrls[0];
                  const mediaObject = message.attachedMedia[0];
                  
                  // Better content type detection
                  const contentType = getCorrectContentType(
                    mediaObject.contentType || '', 
                    mediaObject.filename || '',
                    mediaUrl.url || mediaUrl
                  );
                  
                  mediaInfo = {
                    filename: mediaObject.filename || 'attachment',
                    contentType: contentType,
                    size: mediaObject.size || 0,
                    url: mediaUrl.url || mediaUrl
                  };
                    console.log('Created mediaInfo from getTemporaryContentUrlsForAttachedMedia:', mediaInfo);
                  }
                }
              } catch (error) {
                console.error('Error getting media URLs:', error);
              }
            }
            
            // Fallback: Check for attachedMedia property
            if (!mediaInfo) {
              const attachedMedia = message.attachedMedia;
              if (attachedMedia && attachedMedia.length > 0) {
                console.log('Processing attachedMedia property...');
                const media = attachedMedia[0];
                console.log('Media object:', media);
              
                try {
                  const mediaUrl = await media.getContentTemporaryUrl();
                  console.log('Got media URL:', mediaUrl);
                  
                  mediaInfo = {
                    filename: media.filename || 'attachment',
                    contentType: getCorrectContentType(media.contentType || '', media.filename || '', mediaUrl),
                    size: media.size || 0,
                    url: mediaUrl
                  };
                  console.log('Created mediaInfo:', mediaInfo);
                } catch (error) {
                  console.error('Error getting media URL from attachedMedia:', error);
                  
                  // Fallback: try to get URL directly from media object
                  try {
                    mediaInfo = {
                      filename: media.filename || 'attachment',
                      contentType: getCorrectContentType(media.contentType || '', media.filename || '', media.url || null),
                      size: media.size || 0,
                      url: media.url || null
                    };
                    console.log('Created fallback mediaInfo:', mediaInfo);
                  } catch (fallbackError) {
                    console.error('Fallback media processing failed:', fallbackError);
                  }
                }
              }
            }
            
            // Additional fallback: Check for media property
            if (!mediaInfo) {
              const mediaProperty = message.media;
              if (mediaProperty && mediaProperty.length > 0) {
                console.log('Processing media property...');
                const media = mediaProperty[0];
                console.log('Media object from media property:', media);
                
                try {
                  const mediaUrl = await media.getContentTemporaryUrl();
                  console.log('Got media URL from media property:', mediaUrl);
                  
                  mediaInfo = {
                    filename: media.filename || 'attachment',
                    contentType: getCorrectContentType(media.contentType || '', media.filename || '', mediaUrl),
                    size: media.size || 0,
                    url: mediaUrl
                  };
                  console.log('Created mediaInfo from media property:', mediaInfo);
                } catch (error) {
                  console.error('Error getting media URL from media property:', error);
                }
              }
            }
            
            const newMessage = {
              sid: message.sid,
              body: message.body || '',
              author: message.author,
              timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
              media: mediaInfo
            };
            
            console.log('Final processed message:', newMessage);
            
            // Prevent duplicate messages and update state
            setMessages(prev => {
              const messageExists = prev.some(msg => msg.sid === message.sid);
              if (messageExists) {
                console.log('Message already exists, skipping:', message.sid);
                return prev;
              }
              console.log('Adding new message to state');
              return [...prev, newMessage];
            });
            
            // Auto-scroll to bottom when new message arrives
            setTimeout(conditionalScrollToBottom, 100);
          });

          // Load existing messages in background (don't block UI)
          setIsLoadingMessages(true);
          conversation.getMessages().then(async (existingMessages) => {
            console.log('Loading existing messages:', existingMessages.items.length);
            
            // Process messages in batches for better performance
            const batchSize = 10;
            const messages = existingMessages.items;
            const processedMessages = [];
            
            for (let i = 0; i < messages.length; i += batchSize) {
              const batch = messages.slice(i, i + batchSize);
              const batchProcessed = await Promise.all(
                batch.map(async (message: any) => {
                  let mediaInfo = null;
                  
                  console.log('Processing existing message:', message.sid, 'attachedMedia:', message.attachedMedia, 'media:', message.media);
                  
                  // Try to get the actual message data for existing messages too
                  let actualMessage = message;
                  if (message.state && typeof message.state === 'object') {
                    actualMessage = message.state;
                    console.log('Using existing message.state as actual message data');
                  }
                  console.log('Full message object:', message);
                  console.log('Message body:', message.body);
                  console.log('Message attributes:', message.attributes);
                  console.log('All message properties:', Object.keys(message));
                  
                  // Check if existing message has state property
                  if (message.state) {
                    console.log('Existing message state:', message.state);
                  }
                  
                  // Check for attachedMedia (newer API)
                  const attachedMedia = actualMessage.attachedMedia || message.attachedMedia;
                  if (attachedMedia && attachedMedia.length > 0) {
                    console.log('Processing existing message attachedMedia...');
                    const media = attachedMedia[0];
                    try {
                      const mediaUrl = await media.getContentTemporaryUrl();
                      console.log('Got existing message media URL:', mediaUrl);
                      
                      mediaInfo = {
                        filename: media.filename || 'attachment',
                        contentType: getCorrectContentType(media.contentType || '', media.filename || '', mediaUrl),
                        size: media.size || 0,
                        url: mediaUrl
                      };
                    } catch (error) {
                      console.error('Error getting media URL for existing message:', error);
                      
                      // Fallback: try to get URL directly from media object
                      try {
                        mediaInfo = {
                          filename: media.filename || 'attachment',
                          contentType: getCorrectContentType(media.contentType || '', media.filename || '', media.url || null),
                          size: media.size || 0,
                          url: media.url || null
                        };
                        console.log('Created fallback mediaInfo for existing message:', mediaInfo);
                      } catch (fallbackError) {
                        console.error('Fallback media processing failed for existing message:', fallbackError);
                      }
                    }
                  }
                  // Check for media property (alternative API)
                  const mediaProperty = actualMessage.media || message.media;
                  if (!mediaInfo && mediaProperty && mediaProperty.length > 0) {
                    console.log('Processing existing message media property...');
                    const media = mediaProperty[0];
                    try {
                      const mediaUrl = await media.getContentTemporaryUrl();
                      console.log('Got existing message media URL from media property:', mediaUrl);
                      
                      mediaInfo = {
                        filename: media.filename || 'attachment',
                        contentType: getCorrectContentType(media.contentType || '', media.filename || '', mediaUrl),
                        size: media.size || 0,
                        url: mediaUrl
                      };
                    } catch (error) {
                      console.error('Error getting media URL from media property for existing message:', error);
                    }
                  }
                  
                  const processedMessage = {
                    sid: actualMessage.sid || message.sid,
                    body: actualMessage.body || message.body || '',
                    author: actualMessage.author || message.author,
                    timestamp: actualMessage.timestamp ? new Date(actualMessage.timestamp) : 
                              (message.timestamp ? new Date(message.timestamp) : new Date()),
                    media: mediaInfo
                  };
                  
                  console.log('Processed existing message:', processedMessage);
                  return processedMessage;
                })
              );
              processedMessages.push(...batchProcessed);
            }
            
            setMessages(processedMessages);
            setIsLoadingMessages(false);
            console.log('Loaded', processedMessages.length, 'existing messages');
          }).catch(error => {
            console.error('Error loading existing messages:', error);
            setIsLoadingMessages(false);
          });
        }
      } catch (err) {
        console.error('Chat initialization error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize chat';
        
        // If it's an auth error, set authError instead of general error
        if (errorMessage.includes('Current user ID not found')) {
          setAuthError(errorMessage);
        } else {
          setError(errorMessage);
        }
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
        console.log('File details:', {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size
        });
        
        // Ensure the file has the correct MIME type
        const fileWithCorrectType = new File([selectedFile], selectedFile.name, {
          type: selectedFile.type || 'image/jpeg', // Default to image/jpeg if type is missing
          lastModified: selectedFile.lastModified
        });
        console.log('File with correct type:', fileWithCorrectType.type);
        
        // Debug: Check what methods are available on the conversation for sending
        const conversationMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(conversation));
        const sendMethods = conversationMethods.filter(method => 
          method.toLowerCase().includes('send') || 
          method.toLowerCase().includes('message') ||
          method.toLowerCase().includes('media')
        );
        console.log('Send-related methods on conversation:', sendMethods);
        
        // Use the correct Twilio Conversations API method for sending media
        try {
          // Method 1: Send message with media using the correct Twilio API
          const sentMessage = await conversation.sendMessage({
            body: newMessage.trim() || '',
            media: fileWithCorrectType
          });
          console.log('Media message sent successfully using media property:', sentMessage);
          console.log('Sent message details:', {
            sid: sentMessage.sid,
            body: sentMessage.body,
            attachedMedia: sentMessage.attachedMedia,
            media: sentMessage.media
          });
          
        } catch (error1) {
          console.log('Media property method failed, trying alternative approaches:', error1.message);
          
          try {
            // Method 2: Try sending with media as an array
            const sentMessage = await conversation.sendMessage({
              body: newMessage.trim() || '',
              media: [fileWithCorrectType]
            });
            console.log('Media array method succeeded:', sentMessage);
            
                      } catch (error2) {
              console.log('Media array method failed, trying FormData:', error2.message);
              
              try {
                // Method 3: Try FormData with proper Twilio API
                const formData = new FormData();
                formData.append('Body', newMessage.trim() || '');
                formData.append('Media', fileWithCorrectType);
                
                const sentMessage = await conversation.sendMessage(formData);
                console.log('FormData method succeeded:', sentMessage);
                
              } catch (error3) {
                console.log('FormData method failed, trying text fallback:', error3.message);
                
                try {
                  // Method 4: Send text message as fallback
                  const fallbackMessage = newMessage.trim() || `Attempted to send ${fileWithCorrectType.type.startsWith('image/') ? 'an image' : 'a file'}: ${fileWithCorrectType.name}`;
                  const sentMessage = await conversation.sendMessage(fallbackMessage);
                  console.log('Sent fallback text message:', sentMessage);
                  
                  throw new Error(`Failed to send media file. Sent text message instead. Original errors: ${error1.message}, ${error2.message}, ${error3.message}`);
                } catch (error4) {
                  console.error('All media sending methods failed:', error4);
                  throw new Error(`Failed to send media: ${error4.message}`);
                }
              }
          }
        }
        
        // Clear file selection
        setSelectedFile(null);
        setFilePreview(null);
      } else {
        // Send text message
        console.log('Sending text message:', newMessage);
        const sentMessage = await conversation.sendMessage(newMessage);
        console.log('Text message sent successfully:', sentMessage);
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

  if (isLoading && isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-red-500 rounded-full blur-lg opacity-50"></div>
            <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
            </div>
          </div>
          <p className="text-white/70 font-medium">Initializing chat...</p>
        </div>
      </div>
    );
  }

  // Special handling for authentication errors
  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Authentication Required</h3>
            <p className="text-red-400 text-sm mb-6">{authError}</p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
              >
                Login Again
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="w-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
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
              {isLoadingMessages && (
                <div className="flex items-center space-x-2 mt-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white/40"></div>
                  <span className="text-xs text-white/60">Loading messages...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        <Card 
          className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden relative"
          style={{
            backgroundImage: 'url(/chat_background.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'scroll'
          }}
        >
          {/* Background overlay for better content readability */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
          <CardContent className="p-6 relative z-10">
            <div 
              ref={messagesContainerRef}
              className="space-y-4 h-[calc(100vh-300px)] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] relative"
            >
              {messages.map((message, index) => (
                <div
                  key={`${message.sid}-${index}-${message.timestamp.getTime()}`}
                  className={`flex relative z-10 ${message.author === localStorage.getItem('userUID') ? 'justify-end' : 'justify-start'}`}
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
                        console.log('Media URL available:', !!message.media.url);
                        console.log('Media content type:', message.media.contentType);
                        console.log('Media filename:', message.media.filename);
                        console.log('Is image?', message.media.contentType && message.media.contentType.startsWith('image/'));
                        
                        // Additional debugging for platform-specific issues
                        console.log('Platform detection - User Agent:', navigator.userAgent);
                        console.log('Platform detection - Platform:', navigator.platform);
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
              <div ref={messagesEndRef} className="relative z-10" />
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
            <div className="mt-4 flex gap-2 items-center">
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
                size="sm"
                className="bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border-white/10 flex-shrink-0 w-10 h-10 p-0"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/90 placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 text-sm"
              />
              <Button
                onClick={handleSendMessage}
                variant="outline"
                size="sm"
                disabled={isSending}
                className="bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 hover:text-blue-100 flex-shrink-0 w-10 h-10 p-0"
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