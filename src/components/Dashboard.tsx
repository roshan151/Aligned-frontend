import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Heart, Bell, Clock, Users, User, LogOut, Star } from "lucide-react";
import { config } from "../config/api";
import UserActions from "./UserActions";
import ProfileView from "./ProfileView";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import ChatWithDestiny from "./ChatWithDestiny";

interface User {
  UID: string;
  name: string;
  email?: string;
  city?: string;
  country?: string;
  age?: number;
  gender?: string;
  hobbies?: string | string[];
  profilePicture?: string;
  bio?: string;
  images?: string[];
  kundliScore?: number;
}

interface DashboardMessage {
  id: string;
  text: string;
  timestamp: Date;
  userName?: string;
}

interface Notification {
  message: string;
  updated: string;
}

interface DashboardProps {
  userUID: string | null;
  setIsLoggedIn: (value: boolean) => void;
  onLogout?: () => void;
  cachedData?: any;
  isLoadingData?: boolean;
  notifications?: Notification[];
}

const Dashboard = ({ userUID, setIsLoggedIn, onLogout, cachedData, isLoadingData, notifications = [] }: DashboardProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<User[]>([]);
  const [recommendations, setRecommendations] = useState<User[]>([]);
  const [notificationUsers, setNotificationUsers] = useState<User[]>([]);
  const [awaiting, setAwaiting] = useState<User[]>([]);
  const [messages, setMessages] = useState<DashboardMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isMatchesOpen, setIsMatchesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    // Set system notifications from props if provided
    console.log('Dashboard useEffect - notifications prop:', notifications);
    console.log('Dashboard useEffect - notifications length:', notifications.length);
    console.log('Dashboard useEffect - notifications content:', JSON.stringify(notifications, null, 2));
    
    if (notifications && notifications.length > 0) {
      console.log('Setting system notifications from props:', notifications);
      setSystemNotifications(notifications);
      setHasNewNotifications(true);
    } else {
      console.log('No notifications received in props or empty array');
      setSystemNotifications([]);
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

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
  };

  const handleActionComplete = (action: 'skip' | 'align', queue?: string, message?: string) => {
    if (!selectedUser) return;

    // Remove user from current list first
    const userUID = selectedUser.UID;
    setRecommendations(prev => prev.filter(user => user.UID !== userUID));
    setMatches(prev => prev.filter(user => user.UID !== userUID));
    setNotificationUsers(prev => prev.filter(user => user.UID !== userUID));
    setAwaiting(prev => prev.filter(user => user.UID !== userUID));

    // Add message to notifications if present
    if (message && message !== 'None') {
      addMessage(message, selectedUser.name);
    }

    // Handle queue management based on API response
    if (queue && queue !== 'None') {
      switch (queue) {
        case 'MATCHED':
        case 'Matched':
          // Move to matches (Aligned queue - the heart button on top left)
          setMatches(prev => [...prev, selectedUser]);
          console.log(`Moving user ${selectedUser.name} to matches queue`);
          break;
        case 'AWAITING':
        case 'Awaiting':
          // Move to awaiting (Pending tab)
          setAwaiting(prev => [...prev, selectedUser]);
          console.log(`Moving user ${selectedUser.name} to awaiting queue`);
          break;
        default:
          console.log(`Unknown queue type: ${queue}, removing user from all queues`);
          break;
      }
    } else {
      console.log(`Queue is None or undefined, removing user ${selectedUser.name} from all queues`);
    }

    // Close the profile view
    setSelectedUser(null);
  };

  const formatNotificationDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
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

  const UserCard = ({ user }: { user: User }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="group relative overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-500 hover:scale-[1.02] shadow-xl hover:shadow-2xl cursor-pointer">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <CardContent className="p-6 relative z-10" onClick={() => handleUserClick(user)}>
          <div className="flex items-start space-x-4">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-2 ring-white/20 group-hover:ring-white/40 transition-all duration-300">
                <AvatarImage 
                  src={user.profilePicture || (user.images && user.images.length > 0 ? user.images[0] : undefined)} 
                  className="object-cover w-full h-full"
                />
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white font-semibold text-xl">
                  {user.name?.charAt(0) || <User className="w-10 h-10" />}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -inset-1 bg-gradient-to-br from-violet-400 to-purple-400 rounded-full blur opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-white/90 truncate group-hover:text-white transition-colors mb-1">
                {user.name || 'Unknown User'}
              </h3>
              {user.city && user.country && (
                <p className="text-sm text-white/60 truncate mb-1">
                  📍 {user.city}, {user.country}
                </p>
              )}
              {user.age && (
                <p className="text-sm text-white/60 mb-1">
                  🎂 {user.age} years old
                </p>
              )}
              {user.kundliScore !== undefined && user.kundliScore !== null && (
                <div className="flex items-center mb-2">
                  <Star className="w-4 h-4 text-yellow-400 mr-1" />
                  <span className="text-sm text-yellow-200 font-medium">
                    Compatibility: {user.kundliScore}/36
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

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
              userUID={selectedUser.UID} 
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
            <Popover open={isMatchesOpen} onOpenChange={setIsMatchesOpen}>
              <PopoverTrigger asChild>
                <div className="relative cursor-pointer">
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl blur opacity-30"></div>
                  <img 
                    src="/lovable-uploads/b01e8af5-640c-4d6b-a324-774afb9bbf88.png" 
                    alt="Aligned Logo" 
                    className="relative w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 object-cover rounded-xl hover:scale-105 transition-transform duration-300"
                  />
                  {matches.length > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 sm:h-6 sm:w-6 p-0 flex items-center justify-center bg-red-500 text-white text-xs font-bold">
                      {matches.length}
                    </Badge>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-white/5 backdrop-blur-xl border border-white/10" align="start">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-semibold text-white text-lg">Your Matches</h3>
                  <p className="text-white/60 text-sm">People who liked you back</p>
                </div>
                <div className="max-h-96 overflow-y-auto p-4">
                  {matches.length > 0 ? (
                    <div className="space-y-3">
                      {matches.map((user) => (
                        <div 
                          key={`match-${user.UID}`}
                          className="flex items-center space-x-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                          onClick={() => {
                            handleUserClick(user);
                            setIsMatchesOpen(false);
                          }}
                        >
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={user.profilePicture || (user.images && user.images.length > 0 ? user.images[0] : undefined)} />
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-500 text-white">
                              {user.name?.charAt(0) || <User className="w-6 h-6" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{user.name}</p>
                            {user.kundliScore !== undefined && user.kundliScore !== null && (
                              <div className="flex items-center">
                                <Star className="w-3 h-3 text-yellow-400 mr-1" />
                                <span className="text-xs text-white/70">
                                  {user.kundliScore}/36
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Heart className="w-8 h-8 text-white/40 mx-auto mb-2" />
                      <p className="text-white/60 text-sm">No matches yet</p>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <div className="hidden sm:block">
              <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight font-['Lavanderia']">Aligned</h1>
            </div>
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
                    <AnimatePresence>
                      {recommendations.map((user) => (
                        <UserCard key={`recommendation-${user.UID || Math.random()}`} user={user} />
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
                    <AnimatePresence>
                      {awaiting.map((user) => (
                        <UserCard key={`awaiting-${user.UID}`} user={user} />
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
                    <AnimatePresence>
                      {matches.map((user) => (
                        <UserCard key={`match-${user.UID}`} user={user} />
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
