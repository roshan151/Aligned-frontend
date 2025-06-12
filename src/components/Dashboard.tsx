import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, Bell, Clock, Users, User, LogOut, Star, X, MapPin } from "lucide-react";
import { config } from "../config/api";
import UserActions from "./UserActions";
import ProfileView from "./ProfileView";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import ChatWithDestiny from "./ChatWithDestiny";
import React from "react";
import { User as UserType, Notification } from "../types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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
  cachedData?: {
    recommendations?: UserType[];
    matches?: UserType[];
    awaiting?: UserType[];
    notifications?: Notification[];
  };
  isLoadingData?: boolean;
  notifications?: Notification[];
}

const Dashboard = ({ userUID, setIsLoggedIn, onLogout, cachedData, isLoadingData, notifications = [] }: DashboardProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<UserType[]>([]);
  const [recommendations, setRecommendations] = useState<UserType[]>([]);
  const [notificationUsers, setNotificationUsers] = useState<UserType[]>([]);
  const [awaiting, setAwaiting] = useState<UserType[]>([]);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isMatchesOpen, setIsMatchesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [showChat, setShowChat] = useState(true);

  // Add effect to handle cached data from login
  useEffect(() => {
    if (cachedData) {
      console.log('Using cached data from login:', cachedData);
      
      // Set recommendations if available
      if (cachedData.recommendations && cachedData.recommendations.length > 0) {
        console.log('Setting recommendations from cache:', cachedData.recommendations);
        setRecommendations(cachedData.recommendations);
      }

      // Set awaiting if available
      if (cachedData.awaiting && cachedData.awaiting.length > 0) {
        console.log('Setting awaiting from cache:', cachedData.awaiting);
        setAwaiting(cachedData.awaiting);
      }

      // Set matches if available
      if (cachedData.matches && cachedData.matches.length > 0) {
        console.log('Setting matches from cache:', cachedData.matches);
        setMatches(cachedData.matches);
      }
    }
  }, [cachedData]);

  // Add effect for fetching profile and data after login
  useEffect(() => {
    const fetchProfileAndData = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching profile and data...');
        
        // Fetch profile first
        const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profileData = await profileResponse.json();
        console.log('Profile data received:', profileData);

        // Only fetch additional data if we don't have cached data
        if (!cachedData || !cachedData.recommendations || cachedData.recommendations.length === 0) {
          // Fetch recommendations, awaiting, and matches
          const [recommendationsRes, awaitingRes, matchesRes] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/recommendations`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
            }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/awaiting`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
            }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/matches`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json',
              },
            })
          ]);

          if (!recommendationsRes.ok || !awaitingRes.ok || !matchesRes.ok) {
            throw new Error('Failed to fetch user data');
          }

          const [recommendationsData, awaitingData, matchesData] = await Promise.all([
            recommendationsRes.json(),
            awaitingRes.json(),
            matchesRes.json()
          ]);

          console.log('Setting recommendations:', recommendationsData);
          console.log('Setting awaiting:', awaitingData);
          console.log('Setting matches:', matchesData);

          setRecommendations(recommendationsData.recommendations || []);
          setAwaiting(awaitingData.awaiting || []);
          setMatches(matchesData.matches || []);
        }

        // Set notifications if available
        if (profileData.notifications) {
          setSystemNotifications(profileData.notifications);
          setHasNewNotifications(true);
        }

      } catch (error) {
        console.error('Error fetching profile and data:', error);
        if (error instanceof Error && error.message.includes('401')) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Call the fetch function
    fetchProfileAndData();

    // Set up periodic refresh
    const refreshInterval = setInterval(fetchProfileAndData, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [navigate, cachedData]);

  useEffect(() => {
    // Set system notifications from props if provided
    if (notifications && notifications.length > 0) {
      console.log('Setting system notifications from props:', notifications);
      setSystemNotifications(notifications);
      setHasNewNotifications(true);
    }
  }, [notifications]);

  useEffect(() => {
    console.log('Dashboard useEffect - cachedData:', cachedData);
    
    if (cachedData) {
      // Use the data structure from Index.tsx which has already processed the recommendation cards
      if (cachedData.recommendations) {
        console.log('Setting recommendations from cache:', cachedData.recommendations);
        setRecommendations(cachedData.recommendations);
      }
      if (cachedData.matches) {
        console.log('Setting matches from cache:', cachedData.matches);
        setMatches(cachedData.matches);
      }
      if (cachedData.awaiting) {
        console.log('Setting awaiting from cache:', cachedData.awaiting);
        setAwaiting(cachedData.awaiting);
      }
      if (cachedData.notifications) {
        console.log('Setting notifications from cache:', cachedData.notifications);
        setNotificationUsers(cachedData.notifications);
      }
    }
    
    setIsLoading(false);
  }, [cachedData]);

  useEffect(() => {
    // Initialize chat state
    console.log('Dashboard - Initializing chat state');
    // Only check session storage if we have a userUID
    if (userUID) {
      const chatDismissed = sessionStorage.getItem('destinyChatDismissed');
      const chatCompleted = sessionStorage.getItem('destinyChatCompleted');
      
      console.log('Dashboard - Chat state from session:', {
        chatDismissed,
        chatCompleted,
        userUID
      });
      
      // Only disable chat if explicitly dismissed or completed
      if (chatDismissed === 'true' || chatCompleted === 'true') {
        console.log('Dashboard - Chat disabled by session state');
        setShowChat(false);
      } else {
        console.log('Dashboard - Enabling chat');
        setShowChat(true);
      }
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
    setHasNewNotifications(false); // Reset new notifications indicator when popover is opened
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Fallback to old behavior
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

  const handleUserClick = (user: UserType) => {
    setSelectedUser(user);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
  };

  const handleActionComplete = (action: 'skip' | 'align', queue?: string, message?: string) => {
    // Remove user from current list first
    const userUID = selectedUser.uid;
    setRecommendations(prev => prev.filter(user => user.uid !== userUID));
    setMatches(prev => prev.filter(user => user.uid !== userUID));
    setNotificationUsers(prev => prev.filter(user => user.uid !== userUID));
    setAwaiting(prev => prev.filter(user => user.uid !== userUID));

    // Add message to notifications if present
    if (message && message !== 'None') {
      addMessage(message, selectedUser.name);
    }

    // Handle queue management
    if (queue && queue !== 'None') {
      switch (queue) {
        case 'MATCHED':
        case 'Matched':
          // Move to matches queue
          setMatches(prev => [...prev.filter(u => u.uid !== userUID), selectedUser]);
          console.log(`Moving user ${selectedUser.name} to matches queue`);
          break;
        case 'AWAITING':
        case 'Awaiting':
          // Move to awaiting queue
          setAwaiting(prev => [...prev.filter(u => u.uid !== userUID), selectedUser]);
          console.log(`Moving user ${selectedUser.name} to awaiting queue`);
          break;
        default:
          console.log(`Unknown queue type: ${queue}, removing user from all queues`);
          break;
      }
    } else {
      console.log(`Queue is None, removing user from all queues`);
    }

    // Close the profile view
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

  // Calculate total notification count - only system notifications and messages, not user notifications
  const totalNotificationCount = messages.length + systemNotifications.length;

  console.log('Dashboard render - Current systemNotifications:', systemNotifications);
  console.log('Dashboard render - Current systemNotifications length:', systemNotifications.length);
  console.log('Dashboard render - Current messages:', messages);
  console.log('Dashboard render - Total notification count:', totalNotificationCount);

  const UserCard = React.forwardRef<HTMLDivElement, { user: UserType }>(({ user }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showPhotos, setShowPhotos] = useState(false);

    const handleCardClick = (e: React.MouseEvent) => {
      // Only open dialog if the click is on the card background, not on a button
      if ((e.target as HTMLElement).closest('button')) return;
      setShowPhotos(true);
    };

    const handleAction = async (actionType: 'skip' | 'align') => {
      if (!userUID) return;
      
      setIsLoading(true);
      try {
        const formData = new FormData();
        const metadata = {
          uid: userUID,                    // current user's UID
          action: actionType,              // 'align' or 'skip'
          recommendation_uid: user.uid     // the uid of the card being acted upon
        };

        formData.delete('metadata');
        formData.append('metadata', JSON.stringify(metadata));

        const response = await fetch(`${config.URL}/account:action`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.error === 'OK') {
            // Handle queue management based on response
            const queue = data.queue;
            const message = data.message;
            const userAlign = data.user_align;

            // Add notification if message exists
            if (message && message !== 'None') {
              addMessage(message, user.name);
            }

            // First remove user from recommendations
            setRecommendations(prev => prev.filter(u => u.uid !== user.uid));

            // Then handle queue management
            if (queue && queue !== 'None') {
              // Create updated user object with user_align
              const updatedUser = {
                ...user,
                user_align: userAlign
              };

              // Remove user from all queues first
              setMatches(prev => prev.filter(u => u.uid !== user.uid));
              setNotificationUsers(prev => prev.filter(u => u.uid !== user.uid));
              setAwaiting(prev => prev.filter(u => u.uid !== user.uid));

              // Then add to the appropriate queue
              switch (queue) {
                case 'MATCHED':
                case 'Matched':
                  // Move to matches queue
                  setMatches(prev => [...prev, updatedUser]);
                  console.log(`Moving user ${user.name} to matches queue`);
                  break;
                case 'AWAITING':
                case 'Awaiting':
                  // Move to awaiting queue
                  setAwaiting(prev => [...prev, updatedUser]);
                  console.log(`Moving user ${user.name} to awaiting queue`);
                  break;
                default:
                  console.log(`Unknown queue type: ${queue}, user removed from all queues`);
                  break;
              }
            } else {
              console.log(`Queue is None, removing user from all queues`);
              // Remove from all queues if no specific queue is specified
              setMatches(prev => prev.filter(u => u.uid !== user.uid));
              setNotificationUsers(prev => prev.filter(u => u.uid !== user.uid));
              setAwaiting(prev => prev.filter(u => u.uid !== user.uid));
            }
          } else {
            console.error('API error:', data.error);
          }
        } else {
          throw new Error('Network response was not ok');
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
                  <AvatarImage src={user.profilePicture || (user.images && user.images.length > 0 ? user.images[0] : undefined)} />
                  <AvatarFallback className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xl font-bold">
                    {user.name?.charAt(0) || <User className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                  {user.age && (
                    <p className="text-white/70">{user.age} years old</p>
                  )}
                  {user.city && user.country && (
                    <p className="text-white/70">📍 {user.city}, {user.country}</p>
                  )}
                  {user.kundliScore !== undefined && (
                    <div className="flex items-center mt-1">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm text-white/70 font-medium">
                        Compatibility: {user.kundliScore}/10
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {user.hobbies && (
                  typeof user.hobbies === 'string' ? (
                    user.hobbies.split(',').map((hobby, index) => (
                      <Badge key={`hobby-${user.uid}-${index}`} variant="secondary" className="bg-white/10 text-white/90 hover:bg-white/20 border border-white/20">
                        {hobby.trim()}
                      </Badge>
                    ))
                  ) : (
                    user.hobbies.map((hobby, index) => (
                      <Badge key={`hobby-${user.uid}-${index}`} variant="secondary" className="bg-white/10 text-white/90 hover:bg-white/20 border border-white/20">
                        {hobby}
                      </Badge>
                    ))
                  )
                )}
              </div>

              <div className="flex justify-center items-center gap-6 mt-6">
                {/* Align Button or Waiting Clock */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                  {user.user_align ? (
                    // Show waiting clock icon if user_align is true
                    <div className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 text-white/80 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-emerald-300" />
                    </div>
                  ) : (
                    // Show align button if user_align is false
                    <Button
                      onClick={e => { e.stopPropagation(); handleAction('align'); }}
                      variant="outline"
                      size="lg"
                      disabled={isLoading}
                      className="relative w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border-2 border-white/10 hover:border-emerald-400/50 text-white/80 hover:text-emerald-300 transition-all duration-300 hover:scale-110 shadow-2xl hover:shadow-emerald-500/25 group-hover:bg-gradient-to-r group-hover:from-emerald-500/10 group-hover:to-green-500/10"
                    >
                      <Heart className="w-4 h-4 group-hover:scale-110 group-hover:fill-current transition-all duration-300" />
                    </Button>
                  )}
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60 font-medium">
                    {user.user_align ? 'Waiting' : 'Align'}
                  </span>
                </div>

                {/* Skip Button */}
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
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Dialog open={showPhotos} onOpenChange={setShowPhotos}>
          <DialogContent className="max-w-lg bg-purple-950/30 backdrop-blur-xl border-white/20 [&>button]:hidden">
            <div className="absolute right-4 top-4">
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
            <div className="flex flex-col gap-6 pt-4">
              {/* User Info Section */}
              <div className="flex items-start gap-4">
                <Avatar className="w-20 h-20 ring-2 ring-white/20">
                  <AvatarImage src={user.profilePicture || (user.images && user.images.length > 0 ? user.images[0] : undefined)} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white font-semibold text-xl">
                    {user.name?.charAt(0) || <User className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white mb-2">{user.name}</h2>
                  {user.city && user.country && (
                    <p className="text-white/80 flex items-center gap-2 mb-2 text-sm">
                      <MapPin className="w-4 h-4" />
                      {user.city}, {user.country}
                    </p>
                  )}
                  {user.kundliScore !== undefined && (
                    <p className="text-white/80 flex items-center gap-2 mb-2 text-sm">
                      <Star className="w-4 h-4 text-yellow-400" />
                      Compatibility: {user.kundliScore}/10
                    </p>
                  )}
                  {user.hobbies && user.hobbies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(typeof user.hobbies === 'string' ? user.hobbies.split(',').map(h => h.trim()) : user.hobbies).map((hobby, index) => (
                        <Badge key={`hobby-${user.uid}-${index}`} variant="secondary" className="bg-white/10 text-white/90 hover:bg-white/20 border border-white/20 text-xs">
                          {hobby}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Carousel */}
              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-sm px-12">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {user.images?.map((image, index) => (
                        <CarouselItem key={`image-${user.uid}-${index}`}>
                          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 max-h-[400px]">
                            <img
                              src={image}
                              alt={`Photo ${index + 1} of ${user.name}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.error('Failed to load image:', image);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {user.images && user.images.length > 1 && (
                      <>
                        <CarouselPrevious className="bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 -left-12" />
                        <CarouselNext className="bg-white/10 backdrop-blur-xl border-white/20 text-white hover:bg-white/20 -right-12" />
                      </>
                    )}
                  </Carousel>
                </div>
              </div>
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

  if (selectedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <ProfileView user={selectedUser} onBack={handleBackToList}>
            <UserActions 
              userUID={selectedUser.uid} 
              currentUserUID={userUID}
              onActionComplete={handleActionComplete}
            />
          </ProfileView>
        </div>
      </div>
    );
  }

  if (isLoadingData && (!cachedData || Object.keys(cachedData).length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
    );
  }

  // Add debug logging for render
  console.log('Dashboard - Rendering with state:', {
    showChat,
    userUID,
    isLoadingData,
    hasCachedData: !!cachedData
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Modern Header - Mobile Optimized */}
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
                    {/* Show system notifications from login response */}
                    {systemNotifications.length > 0 && systemNotifications.map((notification, index) => (
                      <div key={`system-${index}`} className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-white/10">
                        <p className="text-white text-sm">{notification.message}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {formatNotificationDate(notification.updated)}
                        </p>
                      </div>
                    ))}
                    
                    {/* Show messages from user actions */}
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
                    
                    {/* Show empty state if no notifications */}
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
        <Tabs defaultValue="recommendations" className="space-y-6 sm:space-y-8">
          <TabsList className="grid w-full grid-cols-3 bg-white/5 backdrop-blur-xl border border-white/10 p-1 rounded-2xl">
            <TabsTrigger 
              value="recommendations" 
              className="flex items-center gap-1 sm:gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium rounded-xl transition-all duration-300 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Discover</span>
              <Badge variant="secondary" className="bg-white/20 text-white/80 text-xs">
                {isLoadingData ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  recommendations.length
                )}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="awaiting" 
              className="flex items-center gap-1 sm:gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium rounded-xl transition-all duration-300 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            >
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Awaiting</span>
              <Badge variant="secondary" className="bg-white/20 text-white/80 text-xs">
                {isLoadingData ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  awaiting.length
                )}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="matches" 
              className="flex items-center gap-1 sm:gap-2 text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium rounded-xl transition-all duration-300 py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Matches</span>
              <Badge variant="secondary" className="bg-white/20 text-white/80 text-xs">
                {isLoadingData ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  matches.length
                )}
              </Badge>
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
                {recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {recommendations.map((user) => (
                        <UserCard 
                          key={`recommendation-${user.uid}`} 
                          user={user} 
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
                {awaiting.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {awaiting.map((user) => (
                        <UserCard key={`awaiting-${user.uid}`} user={user} />
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
                {matches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {matches.map((user) => (
                        <UserCard key={`match-${user.uid}`} user={user} />
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
        <ChatWithDestiny 
          userUID={userUID}
          onClose={() => {
            console.log('Dashboard - Chat closed by user');
            setShowChat(false);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
