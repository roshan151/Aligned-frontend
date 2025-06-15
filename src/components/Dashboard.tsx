import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, Bell, Clock, Users, User, LogOut, Star, X, MapPin, MessageCircle } from "lucide-react";
import { config } from "../config/api";
import { S3_CONFIG } from "../config/s3";
import UserActions from "./UserActions";
import ProfileView from "./ProfileView";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import ChatWithDestiny from "./ChatWithDestiny";
import React from "react";
import { User as UserType, Notification } from "../types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { getSignedS3Url, extractS3Key } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface DashboardMessage {
  id: string;
  text: string;
  timestamp: Date;
  userName?: string;
}

interface DashboardProps {
  userUID: string | null;
  setIsLoggedIn: (value: boolean) => void;
  onLogout: () => void;
  notifications?: Notification[];
}

interface RecommendationCard {
  recommendation_uid: string;
  name: string;
  score: number;
  chat_enabled: boolean;
  user_align: boolean;
  images?: string[]; // Array of S3 image URLs
  city?: string;
  country?: string;
  hobbies?: string;
  profession?: string;
}

const Dashboard = ({ userUID, setIsLoggedIn, onLogout, notifications = [] }: DashboardProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<RecommendationCard[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [awaiting, setAwaiting] = useState<RecommendationCard[]>([]);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({
    recommendations: false,
    matches: false,
    awaiting: false
  });
  const [selectedUser, setSelectedUser] = useState<RecommendationCard | null>(null);
  const [isMatchesOpen, setIsMatchesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [activeTab, setActiveTab] = useState("recommendations");
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isWaitingForUser, setIsWaitingForUser] = useState(false);
  const [isInitialResponse, setIsInitialResponse] = useState(false);
  const [isPreferenceChat, setIsPreferenceChat] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to bottom when chat history changes
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Fetch profile data for a recommendation card
  const fetchProfileData = async (uid: string) => {
    try {
      console.log(`Fetching profile data for UID: ${uid}`);
      const response = await fetch(`${config.URL}/get:profile/${uid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile for ${uid}`);
      }

      const data = await response.json();
      console.log(`Received profile data for ${uid}:`, data);

      // Generate signed URLs for all images
      if (data.IMAGES || data.images) {
        const images = data.IMAGES || data.images;
        const signedUrls = await Promise.all(
          images.map(async (url: string) => {
            const key = extractS3Key(url);
            if (key) {
              const signedUrl = await getSignedS3Url(key);
              return signedUrl || url; // Fallback to original URL if signed URL generation fails
            }
            return url;
          })
        );
        data.IMAGES = signedUrls;
        data.images = signedUrls;
      }

      return data;
    } catch (error) {
      console.error(`Error fetching profile for ${uid}:`, error);
      return null;
    }
  };

  // Fetch data for each tab
  const fetchTabData = async (tab: string) => {
    if (!userUID) return;
    
    // If tab is already loaded and has data, don't fetch again
    if (loadedTabs.has(tab)) {
      const hasData = tab === "recommendations" ? recommendations.length > 0 :
                     tab === "matches" ? matches.length > 0 :
                     awaiting.length > 0;
      if (hasData) return;
    }
    
    try {
      setIsLoading(prev => ({ ...prev, [tab]: true }));
      const endpoint = tab === "recommendations" 
        ? `/get:recommendations/${userUID}`
        : tab === "matches"
        ? `/get:matches/${userUID}`
        : `/get:awaiting/${userUID}`;

      console.log(`Fetching ${tab} data from: ${config.URL}${endpoint}`);

      const response = await fetch(`${config.URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${tab}`);
      }

      const data = await response.json();
      console.log(`Raw ${tab} data:`, data);
      
      // Get the list of cards from the response
      const cards = data.cards || [];
      console.log(`Cards from ${tab}:`, cards);
      
      if (cards.length === 0) {
        console.log(`No cards found for ${tab}`);
        switch (tab) {
          case "recommendations":
            setRecommendations([]);
            break;
          case "matches":
            setMatches([]);
            break;
          case "awaiting":
            setAwaiting([]);
            break;
        }
        setLoadedTabs(prev => new Set([...prev, tab]));
        return;
      }

      // Fetch profile data for each card
      const enrichedCards = await Promise.all(
        cards.map(async (card: any) => {
          console.log(`Processing card:`, card);
          const uid = card.recommendation_uid;
          if (!uid) {
            console.error('No UID found in card:', card);
            return card;
          }
          console.log(`Fetching profile for UID: ${uid}`);
          const profileData = await fetchProfileData(uid);
          if (profileData) {
            const enrichedCard = {
              ...card,
              recommendation_uid: uid,
              name: profileData.NAME || profileData.name || card.name,
              images: profileData.IMAGES || profileData.images || [],
              city: profileData.CITY || profileData.city,
              country: profileData.COUNTRY || profileData.country,
              profession: profileData.PROFESSION || profileData.profession,
              hobbies: profileData.HOBBIES || profileData.hobbies,
              gender: profileData.GENDER || profileData.gender,
              dob: profileData.DOB || profileData.dob
            };
            console.log(`Created enriched card:`, enrichedCard);
            return enrichedCard;
          }
          console.log(`No profile data found for ${uid}, returning original card`);
          return card;
        })
      );
      
      console.log(`Final enriched ${tab} data:`, enrichedCards);
      
      switch (tab) {
        case "recommendations":
          setRecommendations(enrichedCards);
          break;
        case "matches":
          setMatches(enrichedCards);
          break;
        case "awaiting":
          setAwaiting(enrichedCards);
          break;
      }
      setLoadedTabs(prev => new Set([...prev, tab]));
    } catch (error) {
      console.error(`Error fetching ${tab}:`, error);
    } finally {
      setIsLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  // Effect to fetch initial data
  useEffect(() => {
    if (userUID) {
      console.log('Initial data fetch for recommendations...');
      fetchTabData('recommendations');
    }
  }, [userUID]);

  // Effect to handle tab changes
  useEffect(() => {
    if (userUID) {
      console.log(`Tab changed to ${activeTab}, fetching data if needed...`);
      fetchTabData(activeTab);
    }
  }, [userUID, activeTab]);

  // Effect to handle notifications
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      console.log('Setting system notifications from props:', notifications);
      setSystemNotifications(notifications);
      setHasNewNotifications(true);
    }
  }, [notifications]);

  // Effect to initialize chat with destiny after a delay
  useEffect(() => {
    // Check if user has dismissed or completed the chat
    const hasDismissed = sessionStorage.getItem('destinyChatDismissed');
    const hasCompleted = sessionStorage.getItem('destinyChatCompleted');
      
    if (!hasDismissed && !hasCompleted && userUID) {
      console.log('Setting up chat timer with UID:', userUID);
      // Generate random delay between 20 and 70 seconds
      const randomDelay = Math.floor(Math.random() * (70000 - 20000) + 20000);
      console.log(`Chat will appear in ${randomDelay/1000} seconds`);
      
      const timer = setTimeout(async () => {
        try {
          console.log('Making chat:initiate call for UID:', userUID);
          const response = await fetch(`https://lovebhagya.com/chat:initiate/${userUID}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Origin': 'http://localhost:8080'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Chat initiated successfully:', data);
            setChatMessage(data.message);
            // Initialize chat history with the first message
            setChatHistory([{ text: data.message, isUser: false }]);
        setShowChat(true);
            setIsInitialResponse(true);
          } else {
            console.error('Failed to initiate chat:', response.status);
          }
        } catch (error) {
          console.error('Error initiating chat:', error);
        }
      }, randomDelay);
      
      return () => clearTimeout(timer);
    }
  }, [userUID]);

  const addMessage = (text: string, userName?: string) => {
    const newMessage: DashboardMessage = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      userName
    };
    setMessages(prev => [newMessage, ...prev]);
    setHasNewNotifications(true);
  };

  const handleNotificationsOpen = () => {
    setIsNotificationsOpen(true);
    setHasNewNotifications(false);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('userUID');
      localStorage.removeItem('userData');
      localStorage.removeItem('profileData');
      localStorage.removeItem('dashboardData');
      setIsLoggedIn(false);
    }
  };

  const handleViewProfile = () => {
    navigate("/profile");
  };

  const handleUserClick = (user: RecommendationCard) => {
    setSelectedUser(user);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
  };

  const handleActionComplete = (action: 'skip' | 'align', queue?: string, message?: string) => {
    if (!selectedUser) return;

    const userUID = selectedUser.recommendation_uid;
    
    // Remove user from current list
    setRecommendations(prev => prev.filter(user => user.recommendation_uid !== userUID));
    setMatches(prev => prev.filter(user => user.recommendation_uid !== userUID));
    setAwaiting(prev => prev.filter(user => user.recommendation_uid !== userUID));

    // Add message to notifications if present
    if (message && message !== 'None') {
      addMessage(message, selectedUser.name);
    }

    // Handle queue management
    if (queue && queue !== 'None') {
      const updatedUser = {
        ...selectedUser,
        user_align: action === 'align'
      };

      switch (queue) {
        case 'MATCHED':
        case 'Matched':
          setMatches(prev => [...prev.filter(u => u.recommendation_uid !== userUID), updatedUser]);
          break;
        case 'AWAITING':
        case 'Awaiting':
          setAwaiting(prev => [...prev.filter(u => u.recommendation_uid !== userUID), updatedUser]);
          break;
      }
    }

    setSelectedUser(null);
  };

  const formatNotificationDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateStr;
    }
  };

  const totalNotificationCount = messages.length + systemNotifications.length;

  const UserCard = React.forwardRef<HTMLDivElement, { user: RecommendationCard; queue?: string }>(({ user, queue }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showPhotos, setShowPhotos] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);

    // Set profile image when user data changes
    useEffect(() => {
      if (user.images && user.images.length > 0) {
        setProfileImage(user.images[0]); // Use the first image URL directly
      }
    }, [user.images]);

    const handleCardClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      setShowPhotos(true);
    };

    const handleAction = async (actionType: 'skip' | 'align') => {
      if (!userUID) return;
      
      setIsLoading(true);
      try {
        const metadata = {
          uid: userUID,
          action: actionType,
          recommendation_uid: user.recommendation_uid
        };

        const response = await fetch(`${config.URL}/account:action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(metadata)
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.error === 'OK') {
            const queue = data.queue;
            const message = data.message;

            if (message && message !== 'None') {
              addMessage(message, user.name);
            }

            // Remove user from all queues first
            setRecommendations(prev => prev.filter(u => u.recommendation_uid !== user.recommendation_uid));
            setMatches(prev => prev.filter(u => u.recommendation_uid !== user.recommendation_uid));
            setAwaiting(prev => prev.filter(u => u.recommendation_uid !== user.recommendation_uid));

            // If action is skip, we don't need to add to any queue
            if (actionType === 'skip') {
              return;
            }

            // Only add to new queue if it's an align action and we have a queue
            if (queue && queue !== 'None') {
              const updatedUser = {
                ...user,
                user_align: actionType === 'align'
              };

              switch (queue) {
                case 'MATCHED':
                case 'Matched':
                  setMatches(prev => [...prev, updatedUser]);
                  break;
                case 'AWAITING':
                case 'Awaiting':
                  setAwaiting(prev => [...prev, updatedUser]);
                  break;
              }
            }
          }
        }
      } catch (error) {
        console.error('Action error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <>
        <motion.div
          ref={ref}
          className="cursor-pointer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 hover:shadow-3xl transition-all duration-500 group">
            <CardContent className="p-6" onClick={handleCardClick}>
              <div className="flex items-center space-x-4 mb-4">
                <Avatar className="w-16 h-16 ring-2 ring-white/20">
                  {profileImage ? (
                    <AvatarImage src={profileImage} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xl font-bold">
                      {user.name?.charAt(0) || <User className="w-8 h-8" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                  {user.score !== undefined && (
                    <div className="flex items-center mt-1">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm text-white/70 font-medium">
                        Compatibility: {user.score}/10
                      </span>
                    </div>
                  )}
                  {user.city && user.country && (
                    <div className="flex items-center mt-1">
                      <MapPin className="w-4 h-4 text-white/60 mr-1" />
                      <span className="text-sm text-white/60">
                        {user.city}, {user.country}
                      </span>
                    </div>
                  )}
                  {user.hobbies && (
                    <div className="mt-1">
                      <span className="text-sm text-white/60">
                        {user.hobbies.split(',').slice(0, 2).join(', ')}
                        {user.hobbies.split(',').length > 2 ? '...' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center items-center gap-6 mt-6">
                {queue === 'awaiting' ? (
                  // Awaiting queue logic: show align and skip buttons if user_align is false, waiting icon and skip if true
                  user.user_align ? (
                    // Show waiting icon and skip button when user has already aligned
                    <>
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 text-white/80 transition-all duration-300 shadow-2xl flex items-center justify-center">
                          <Clock className="w-4 h-4 animate-pulse" />
                        </div>
                        <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                          Waiting
                        </span>
                      </div>

                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <Button
                          onClick={e => { e.stopPropagation(); handleAction('skip'); }}
                          variant="outline"
                          size="lg"
                          disabled={isLoading}
                          className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-red-400/50 text-white/80 hover:text-red-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-red-500/25 group-hover:bg-gradient-to-r group-hover:from-red-500/10 group-hover:to-pink-500/10"
                        >
                          <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        </Button>
                        <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                          Skip
                        </span>
                      </div>
                    </>
                  ) : (
                    // Show align and skip buttons when user hasn't aligned yet
                    <>
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <Button
                          onClick={e => { e.stopPropagation(); handleAction('align'); }}
                          variant="outline"
                          size="lg"
                          disabled={isLoading}
                          className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-emerald-400/50 text-white/80 hover:text-emerald-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-emerald-500/25 group-hover:bg-gradient-to-r group-hover:from-emerald-500/10 group-hover:to-green-500/10"
                        >
                          <Heart className="w-4 h-4 group-hover:scale-110 group-hover:fill-current transition-all duration-300" />
                        </Button>
                        <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                          Align
                        </span>
                      </div>

                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <Button
                          onClick={e => { e.stopPropagation(); handleAction('skip'); }}
                          variant="outline"
                          size="lg"
                          disabled={isLoading}
                          className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-red-400/50 text-white/80 hover:text-red-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-red-500/25 group-hover:bg-gradient-to-r group-hover:from-red-500/10 group-hover:to-pink-500/10"
                        >
                          <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        </Button>
                        <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                          Skip
                        </span>
                      </div>
                    </>
                  )
                ) : user.user_align ? (
                  // Show chat and block buttons for matched users (non-awaiting queues)
                  <>
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                      <Button
                        onClick={e => { 
                          e.stopPropagation(); 
                          navigate(`/chat/${user.recommendation_uid}`, {
                            state: {
                              userName: user.name,
                              userProfilePicture: profileImage
                            }
                          });
                        }}
                        variant="outline"
                        size="lg"
                        className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-emerald-400/50 text-white/80 hover:text-emerald-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-emerald-500/25 group-hover:bg-gradient-to-r group-hover:from-emerald-500/10 group-hover:to-green-500/10"
                      >
                        <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-all duration-300" />
                      </Button>
                      <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                        Chat
                      </span>
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                      <Button
                        onClick={e => { 
                          e.stopPropagation(); 
                          // TODO: Implement block functionality
                          console.log('Block user:', user.recommendation_uid);
                        }}
                        variant="outline"
                        size="lg"
                        className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-red-400/50 text-white/80 hover:text-red-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-red-500/25 group-hover:bg-gradient-to-r group-hover:from-red-500/10 group-hover:to-pink-500/10"
                      >
                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                      </Button>
                      <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                        Block
                      </span>
                    </div>
                  </>
                ) : (
                  // Show align and skip buttons for non-matched users
                  <>
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                      <Button
                        onClick={e => { e.stopPropagation(); handleAction('align'); }}
                        variant="outline"
                        size="lg"
                        disabled={isLoading}
                        className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-emerald-400/50 text-white/80 hover:text-emerald-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-emerald-500/25 group-hover:bg-gradient-to-r group-hover:from-emerald-500/10 group-hover:to-green-500/10"
                      >
                        <Heart className="w-4 h-4 group-hover:scale-110 group-hover:fill-current transition-all duration-300" />
                      </Button>
                      <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                        Align
                      </span>
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                      <Button
                        onClick={e => { e.stopPropagation(); handleAction('skip'); }}
                        variant="outline"
                        size="lg"
                        disabled={isLoading}
                        className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-red-400/50 text-white/80 hover:text-red-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-red-500/25 group-hover:bg-gradient-to-r group-hover:from-red-500/10 group-hover:to-pink-500/10"
                      >
                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                      </Button>
                      <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                        Skip
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Dialog open={showPhotos} onOpenChange={setShowPhotos}>
          <DialogContent 
            className="max-w-lg bg-white/5 backdrop-blur-xl border border-white/10 [&>button]:hidden overflow-hidden"
            style={{
              backgroundImage: 'url(/chat_background.jpeg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Background overlay for better content readability */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
            
            <DialogTitle className="sr-only">User Profile Photos</DialogTitle>
            <DialogDescription className="sr-only">
              View and browse through user's profile photos
            </DialogDescription>
            <div className="absolute right-4 top-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all duration-300"
                onClick={() => setShowPhotos(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="flex flex-col gap-6 pt-4 relative z-10">
              <div className="flex items-start gap-4">
                <Avatar className="w-20 h-20 ring-2 ring-white/20">
                  {profileImage ? (
                    <AvatarImage src={profileImage} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white font-semibold text-xl">
                      {user.name?.charAt(0) || <User className="w-8 h-8" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white mb-2">{user.name}</h2>
                  {user.score !== undefined && (
                    <p className="text-white/80 flex items-center gap-2 mb-2 text-sm">
                      <Star className="w-4 h-4 text-yellow-400" />
                      Compatibility: {user.score}/10
                    </p>
                  )}
                  {user.city && user.country && (
                    <p className="text-white/80 flex items-center gap-2 mb-2 text-sm">
                      <MapPin className="w-4 h-4" />
                      {user.city}, {user.country}
                    </p>
                  )}
                  {user.hobbies && (
                    <div className="mb-2">
                      <p className="text-white/80 text-sm font-medium mb-1">Hobbies</p>
                      <div className="flex flex-wrap gap-2">
                        {user.hobbies.split(',').map((hobby, index) => (
                          <Badge 
                            key={index}
                            variant="secondary" 
                            className="bg-white/10 text-white/80 border-white/20"
                          >
                            {hobby.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {user.images && user.images.length > 0 && (
                <Carousel className="w-full max-w-md mx-auto px-12">
                  <CarouselContent className="flex items-center">
                    {user.images.map((image, index) => (
                      <CarouselItem key={index} className="flex items-center justify-center">
                        <div className="relative aspect-square rounded-xl overflow-hidden max-h-[300px] w-full">
                          <img
                            src={image}
                            alt={`${user.name}'s photo ${index + 1}`}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 hover:border-white/30" />
                  <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 hover:border-white/30" />
                </Carousel>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  });

  UserCard.displayName = "UserCard";

  const EmptyState = ({ icon: Icon, title, description }: { 
    icon: any; 
    title: string; 
    description: string; 
  }) => (
    <div className="text-center py-20">
      <div className="relative mx-auto mb-6 w-20 h-20">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full blur-xl"></div>
        <div className="relative w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
          <Icon className="w-8 h-8 text-white/60" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-white/90 mb-3">{title}</h3>
      <p className="text-white/60 max-w-md mx-auto leading-relaxed">{description}</p>
    </div>
  );

  const handlePreferenceChat = async () => {
    if (!userUID) return;
    
    try {
      const response = await fetch('https://lovebhagya.com/chat/preference:continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:8080'
        },
        body: JSON.stringify({
          uid: userUID
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Preference chat initiated successfully:', data);
        setChatMessage(data.message);
        setChatHistory(data.history || []);
        setShowChat(true);
        setIsPreferenceChat(true);
      } else {
        console.error('Failed to initiate preference chat:', response.status);
      }
    } catch (error) {
      console.error('Error initiating preference chat:', error);
    }
  };

  const handleChatResponse = async (userInput: string) => {
    if (!userUID) return;
    
    try {
      let endpoint = 'chat/initiate:continue';
      if (isPreferenceChat) {
        endpoint = 'chat/preference:continue';
      } else if (isInitialResponse) {
        endpoint = 'chat/initiate:continue';
      }
      
      const response = await fetch(`https://lovebhagya.com/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:8080'
        },
        body: JSON.stringify({
          uid: userUID,
          user_input: userInput,
          history: chatHistory
        })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setChatMessage(data.message);
          // Add user message and response to chat history
          setChatHistory(prevHistory => [
            ...prevHistory,
            { text: userInput, isUser: true },
            { text: data.message, isUser: false }
          ]);
          setIsInitialResponse(false);
          
          if (data.continue) {
            setIsWaitingForUser(true);
            // Don't automatically continue - wait for user to click send
          } else {
            // Show final message for 2 seconds then close
            setTimeout(() => {
              setShowChat(false);
              sessionStorage.setItem('destinyChatCompleted', 'true');
            }, 2000);
          }
        } else {
          console.error('Expected JSON response but got:', contentType);
        }
      }
    } catch (error) {
      console.error('Error continuing chat:', error);
    }
  };

  const handleChatExit = async () => {
    if (userUID) {
      try {
        // Determine if this is a preference chat by checking if the chat was initiated by preference button
        const isPreferenceChatExit = showChatWindow;
        const endpoint = isPreferenceChatExit ? 'chat/preference:continue' : 'chat/initiate:continue';
        
        const response = await fetch(`https://lovebhagya.com/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'http://localhost:8080'
          },
          body: JSON.stringify({
            uid: userUID,
            user_input: "exit",
            history: chatHistory
          })
        });
        
        if (response.ok) {
          console.log('Chat exit handled successfully');
        }
      } catch (error) {
        console.error('Error handling chat exit:', error);
      }
    }
    setShowChat(false);
    setShowChatWindow(false);
    sessionStorage.setItem('destinyChatDismissed', 'true');
  };

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-x-hidden">
        <div className="container mx-auto px-4 py-8">
          <ProfileView user={selectedUser as unknown as UserType} onBack={handleBackToList}>
            <UserActions 
              userUID={selectedUser.recommendation_uid} 
              currentUserUID={userUID}
              onActionComplete={handleActionComplete}
            />
          </ProfileView>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <h1 className="text-3xl sm:text-6xl font-bold text-white tracking-tight font-['Lavanderia']">Aligned</h1>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Popover open={isNotificationsOpen} onOpenChange={(open) => {
              setIsNotificationsOpen(open);
              if (open) setHasNewNotifications(false);
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="relative border-white/20 bg-white/5 backdrop-blur-xl text-white/90 hover:bg-white/10 hover:border-white/30 transition-all duration-300 font-medium text-xs sm:text-sm px-2 sm:px-4"
                >
                  <Bell className={`w-3 h-3 sm:w-4 sm:h-4 sm:mr-2 ${hasNewNotifications ? 'text-yellow-400 animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">Notifications</span>
                  {totalNotificationCount > 0 && (
                    <Badge className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                      {totalNotificationCount}
                    </Badge>
                  )}
                  {hasNewNotifications && (
                    <span className="absolute top-0 right-0 h-2 w-2 bg-yellow-400 rounded-full animate-ping"></span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-white/5 backdrop-blur-xl border border-white/10" align="end">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-semibold text-white text-lg">Notifications</h3>
                  <p className="text-white/60 text-sm">Recent system updates</p>
                </div>
                <div className="max-h-96 overflow-y-auto p-4">
                  <div className="space-y-3">
                    {systemNotifications.length > 0 && systemNotifications.map((notification, index) => (
                      <div key={`system-${index}`} className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-white/10">
                        <p className="text-white text-sm">{notification.message}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {formatNotificationDate(notification.updated)}
                        </p>
                      </div>
                    ))}
                    
                    {messages.length > 0 && messages.map((message) => (
                      <div key={`message-${message.id}`} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-white text-sm">{message.text}</p>
                        {message.userName && (
                          <p className="text-white/60 text-xs mt-1">From: {message.userName}</p>
                        )}
                        <p className="text-white/40 text-xs mt-1">
                          {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                    
                    {systemNotifications.length === 0 && messages.length === 0 && (
                      <div className="text-center py-8">
                        <Bell className="w-8 h-8 text-white/40 mx-auto mb-2" />
                        <p className="text-white/60 text-sm">No notifications yet</p>
                        <p className="text-white/40 text-xs mt-1">System updates will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button 
              onClick={handleViewProfile}
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 backdrop-blur-xl text-white/90 hover:bg-white/10 hover:border-white/30 transition-all duration-300 font-medium text-xs sm:text-sm px-2 sm:px-4"
            >
              <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="recommendations" className="space-y-6 sm:space-y-8" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-2xl">
            <TabsTrigger 
              value="recommendations" 
              className="flex items-center gap-1 sm:gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium rounded-xl transition-all duration-300 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Discover</span>
            </TabsTrigger>
            <TabsTrigger 
              value="awaiting" 
              className="flex items-center gap-1 sm:gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium rounded-xl transition-all duration-300 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Awaiting</span>
            </TabsTrigger>
            <TabsTrigger 
              value="matches" 
              className="flex items-center gap-1 sm:gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium rounded-xl transition-all duration-300 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Matches</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-6">
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
              <CardHeader className="pb-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl blur opacity-30"></div>
                    <div className="relative w-12 h-12 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-violet-300" />
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-white text-xl font-bold">Discover New People</CardTitle>
                    <CardDescription className="text-white/60 font-medium mt-1">
                      Curated profiles that match your cosmic compatibility
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading.recommendations ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full blur-lg opacity-50"></div>
                        <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
                        </div>
                      </div>
                      <p className="text-white/70 font-medium">Discovering your perfect matches...</p>
                    </div>
                  </div>
                ) : recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {recommendations.map((user) => (
                        <UserCard 
                          key={`recommendation-${user.recommendation_uid}`} 
                          user={user} 
                          queue="recommendations"
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No recommendations yet"
                    description="We're working on finding your perfect matches. Check back soon!"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="awaiting" className="space-y-6">
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
              <CardHeader className="pb-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-30"></div>
                    <div className="relative w-12 h-12 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-300" />
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-white text-xl font-bold">Awaiting Response</CardTitle>
                    <CardDescription className="text-white/60 font-medium mt-1">
                      People waiting for your decision
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading.awaiting ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full blur-lg opacity-50"></div>
                        <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
                        </div>
                      </div>
                      <p className="text-white/70 font-medium">Loading awaiting responses...</p>
                    </div>
                  </div>
                ) : awaiting.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {awaiting.map((user) => (
                        <UserCard key={`awaiting-${user.recommendation_uid}`} user={user} queue="awaiting" />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <EmptyState
                    icon={Clock}
                    title="No pending responses"
                    description="You're all caught up with your responses!"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
              <CardHeader className="pb-6 bg-gradient-to-r from-pink-500/10 to-red-500/10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl blur opacity-30"></div>
                    <div className="relative w-12 h-12 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 flex items-center justify-center">
                      <Heart className="w-6 h-6 text-pink-300" />
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-white text-xl font-bold">Your Matches</CardTitle>
                    <CardDescription className="text-white/60 font-medium mt-1">
                      People who liked you back - it's a match!
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoading.matches ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-red-500 rounded-full blur-lg opacity-50"></div>
                        <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
                        </div>
                      </div>
                      <p className="text-white/70 font-medium">Loading your matches...</p>
                    </div>
                  </div>
                ) : matches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {matches.map((user) => (
                        <UserCard key={`match-${user.recommendation_uid}`} user={user} queue="matches" />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <EmptyState
                    icon={Heart}
                    title="No matches yet"
                    description="Keep swiping to find your perfect match! When someone likes you back, they'll appear here."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {showChat && userUID && (
          <div className="fixed bottom-6 right-6 z-50">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white rounded-lg shadow-xl w-80 sm:w-96 mb-4 border border-indigo-100 flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b flex justify-between items-center bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-t-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-lg font-['Lavanderia']">D</span>
                  </div>
                  <h3 className="font-['Lavanderia'] text-2xl">Destiny</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleChatExit}
                  className="h-8 w-8 hover:bg-indigo-500/20 text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div ref={chatHistoryRef} className="flex-1 overflow-y-auto scroll-smooth p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {chatHistory.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      message.isUser 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-indigo-50 text-gray-700'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your response..."
                    className="flex-1 text-sm border-indigo-100 focus:border-indigo-300 text-gray-900 placeholder:text-gray-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleChatResponse(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      const input = document.querySelector('input');
                      if (input) {
                        handleChatResponse(input.value);
                        input.value = '';
                      }
                    }}
                    className="bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <div className="fixed bottom-6 right-6 z-40">
        <ChatWithDestiny 
          userUID={userUID}
          onClose={() => {
              setShowChatWindow(false);
          }}
            showChatWindow={showChatWindow}
        />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
