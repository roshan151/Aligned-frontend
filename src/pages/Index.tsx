import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "../components/Login";
import Register from "../components/Register";
import Dashboard from "../components/Dashboard";
import Matches from "./Matches";
import Recommendations from "./Recommendations";
import Notifications from "./Notifications";
import Awaiting from "./Awaiting";
import ProfilePage from "./Profile";
import { config } from "../config/api";
import { User, Notification, DashboardData, ProfileData } from "../types";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userUID, setUserUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUserProfile = async (uid: string) => {
    try {
      const response = await fetch(`${config.URL}${config.ENDPOINTS.GET_PROFILE}/${uid}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched user profile:', data);
        return data;
      } else {
        console.error('Error fetching user profile:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  const transformUserData = (data: any): ProfileData => {
    console.log('Raw API data for transformation:', data);
    
    let hobbies: string[] = [];
    if (data.HOBBIES || data.hobbies) {
      try {
        const hobbiesData = data.HOBBIES || data.hobbies;
        const hobbiesArray = typeof hobbiesData === 'string' ? JSON.parse(hobbiesData) : hobbiesData;
        hobbies = Array.isArray(hobbiesArray) ? hobbiesArray : hobbiesData.split(',').map((h: string) => h.trim());
      } catch {
        hobbies = typeof (data.HOBBIES || data.hobbies) === 'string' 
          ? (data.HOBBIES || data.hobbies).split(',').map((h: string) => h.trim()) 
          : [];
      }
    }

    let dob = '';
    if (data.DOB || data.dob) {
      try {
        const dobData = data.DOB || data.dob;
        if (typeof dobData === 'string' && dobData.includes('{')) {
          const dobObj = JSON.parse(dobData);
          dob = `${dobObj.year}-${String(dobObj.month).padStart(2, '0')}-${String(dobObj.day).padStart(2, '0')}`;
        } else {
          dob = dobData;
        }
      } catch {
        dob = data.DOB || data.dob || '';
      }
    }

    const convertBase64ToDataUrl = (base64Data: any): string => {
      if (!base64Data) return '';

      let base64String = '';
      if (typeof base64Data === 'object') {
        base64String = base64Data.data || base64Data.base64 || base64Data.content || base64Data.image || '';
      } else {
        base64String = String(base64Data);
      }

      base64String = base64String.trim();
      
      if (base64String.startsWith('data:')) return base64String;
      if (base64String.startsWith('http://') || base64String.startsWith('https://')) return base64String;
      if (base64String.length > 20 && /^[A-Za-z0-9+/=]+$/.test(base64String)) {
        return `data:image/jpeg;base64,${base64String}`;
      }
      
      return '';
    };

    let images: string[] = [];
    const imageFields = ['IMAGES', 'images', 'profileImages', 'PROFILEIMAGES'];
    
    for (const field of imageFields) {
      if (data[field]) {
        try {
          const imagesData = data[field];
          
          if (typeof imagesData === 'string') {
            try {
              const parsedImages = JSON.parse(imagesData);
              if (Array.isArray(parsedImages)) {
                images = parsedImages
                  .map(img => convertBase64ToDataUrl(img))
                  .filter(url => url && url.length > 0);
              } else {
                const converted = convertBase64ToDataUrl(imagesData);
                if (converted) images = [converted];
              }
            } catch {
              if (imagesData.includes(',')) {
                images = imagesData.split(',')
                  .map((img: string) => convertBase64ToDataUrl(img.trim()))
                  .filter(url => url && url.length > 0);
              } else {
                const converted = convertBase64ToDataUrl(imagesData);
                if (converted) images = [converted];
              }
            }
          } else if (Array.isArray(imagesData)) {
            images = imagesData
              .map(img => convertBase64ToDataUrl(img))
              .filter(url => url && url.length > 0);
          } else if (typeof imagesData === 'object' && imagesData !== null) {
            images = Object.values(imagesData)
              .map(img => convertBase64ToDataUrl(img as string))
              .filter(url => url && url.length > 0);
          }
          
          if (images.length > 0) break;
        } catch (error) {
          console.error(`Error parsing images from field ${field}:`, error);
        }
      }
    }

    return {
      uid: data.UID || data.uid || '',
      name: data.NAME || data.name || 'Unknown User',
      email: data.EMAIL || data.email || '',
      city: data.CITY || data.city || '',
      country: data.COUNTRY || data.country || '',
      birth_city: data.BIRTH_CITY || data.birth_city || '',
      birth_country: data.BIRTH_COUNTRY || data.birth_country || '',
      gender: data.GENDER || data.gender || '',
      profession: data.PROFESSION || data.profession || '',
      dob: dob,
      tob: data.TOB || data.tob || '',
      hobbies: hobbies,
      images: images,
      login: data.LOGIN || data.login || '',
      user_align: data.user_align || false
    };
  };

  const transformLoginDataToProfile = (loginData: any): ProfileData => {
    console.log('Transforming login data to profile:', loginData);
    
    let hobbies: string[] = [];
    if (loginData.hobbies) {
      try {
        const hobbiesArray = typeof loginData.hobbies === 'string' ? JSON.parse(loginData.hobbies) : loginData.hobbies;
        hobbies = Array.isArray(hobbiesArray) ? hobbiesArray : loginData.hobbies.split(',').map((h: string) => h.trim());
      } catch {
        hobbies = typeof loginData.hobbies === 'string' 
          ? loginData.hobbies.split(',').map((h: string) => h.trim()) 
          : [];
      }
    }

    let dob = '';
    if (loginData.dob) {
      try {
        const dobData = loginData.dob;
        if (typeof dobData === 'string' && dobData.includes('{')) {
          const dobObj = JSON.parse(dobData);
          dob = `${dobObj.year}-${String(dobObj.month).padStart(2, '0')}-${String(dobObj.day).padStart(2, '0')}`;
        } else {
          dob = dobData;
        }
      } catch {
        dob = loginData.dob || '';
      }
    }

    const convertBase64ToDataUrl = (base64Data: any): string => {
      if (!base64Data) return '';

      let base64String = '';
      if (typeof base64Data === 'object') {
        base64String = base64Data.data || base64Data.base64 || base64Data.content || base64Data.image || '';
      } else {
        base64String = String(base64Data);
      }

      base64String = base64String.trim();
      
      if (base64String.startsWith('data:')) return base64String;
      if (base64String.startsWith('http://') || base64String.startsWith('https://')) return base64String;
      if (base64String.length > 20 && /^[A-Za-z0-9+/=]+$/.test(base64String)) {
        return `data:image/jpeg;base64,${base64String}`;
      }
      
      return '';
    };

    let images: string[] = [];
    if (loginData.images) {
      try {
        const imagesData = loginData.images;
        
        if (typeof imagesData === 'string') {
          try {
            const parsedImages = JSON.parse(imagesData);
            if (Array.isArray(parsedImages)) {
              images = parsedImages
                .map(img => convertBase64ToDataUrl(img))
                .filter(url => url && url.length > 0);
            } else {
              const converted = convertBase64ToDataUrl(imagesData);
              if (converted) images = [converted];
            }
          } catch {
            if (imagesData.includes(',')) {
              images = imagesData.split(',')
                .map((img: string) => convertBase64ToDataUrl(img.trim()))
                .filter(url => url && url.length > 0);
            } else {
              const converted = convertBase64ToDataUrl(imagesData);
              if (converted) images = [converted];
            }
          }
        } else if (Array.isArray(imagesData)) {
          images = imagesData
            .map(img => convertBase64ToDataUrl(img))
            .filter(url => url && url.length > 0);
        } else if (typeof imagesData === 'object' && imagesData !== null) {
          images = Object.values(imagesData)
            .map(img => convertBase64ToDataUrl(img as string))
            .filter(url => url && url.length > 0);
        }
      } catch (error) {
        console.error('Error parsing images from login data:', error);
      }
    }

    return {
      uid: loginData.uid || '',
      name: loginData.name || 'Unknown User',
      email: loginData.email || '',
      city: loginData.city || '',
      country: loginData.country || '',
      birth_city: '',
      birth_country: '',
      gender: loginData.gender || '',
      profession: loginData.profession || '',
      dob: dob,
      tob: '',
      hobbies: hobbies,
      images: images,
      login: 'SUCCESSFUL'
    };
  };

  const loadRecommendationCards = async (recommendationCards: any[]): Promise<DashboardData> => {
    console.log('Loading recommendation cards:', recommendationCards);
    
    const dashboardData: DashboardData = {
      recommendations: [],
      matches: [],
      awaiting: [],
      notifications: []
    };

    // Process cards progressively
    for (const card of recommendationCards) {
      try {
        const { recommendation_uid, score, queue } = card;
        console.log(`Loading profile for ${recommendation_uid} in queue ${queue} with score ${score}`);
        
        const userProfile = await fetchUserProfile(recommendation_uid);
        if (userProfile) {
          const transformedUser = transformUserData(userProfile);
          
          // Add the kundliScore from the recommendation card
          const userWithScore = {
            ...transformedUser,
            kundliScore: score !== undefined && score !== null ? score : undefined,
            user_align: card.user_align
          };
          
          console.log(`User ${transformedUser.name} has score: ${score}`);
          
          // Add to appropriate queue based on the queue field
          switch (queue) {
            case 'RECOMMENDATIONS':
              dashboardData.recommendations.push(userWithScore);
              break;
            case 'MATCHED':
              dashboardData.matches.push(userWithScore);
              break;
            case 'AWAITING':
              dashboardData.awaiting.push(userWithScore);
              break;
            default:
              console.warn(`Unknown queue type: ${queue}`);
              dashboardData.recommendations.push(userWithScore);
          }
        }
      } catch (error) {
        console.error('Error loading recommendation card:', card, error);
      }
    }

    return dashboardData;
  };

  const handleSuccessfulLogin = async (uid: string, loginData: any) => {
    console.log('Handling successful login with data:', loginData);
    setUserUID(uid);
    setIsLoggedIn(true);
    
    // Store notifications from login response
    if (loginData.notifications && Array.isArray(loginData.notifications)) {
      console.log('Setting system notifications from login:', loginData.notifications);
      // Remove duplicates based on message and updated timestamp
      const uniqueNotifications = loginData.notifications.filter((notification, index, self) =>
        index === self.findIndex((n) => 
          n.message === notification.message && n.updated === notification.updated
        )
      );
      setSystemNotifications(uniqueNotifications);
    }

    // Transform and store profile data from login response
    const profileDataFromLogin = transformLoginDataToProfile(loginData);
    console.log('Profile data from login:', profileDataFromLogin);
    setProfileData(profileDataFromLogin);
    localStorage.setItem('profileData', JSON.stringify(profileDataFromLogin));

    // Store the complete login data
    localStorage.setItem('userData', JSON.stringify(loginData));
    
    // Initialize empty dashboard data
    const initialDashboardData: DashboardData = {
      recommendations: [],
      matches: [],
      awaiting: [],
      notifications: []
    };
    setDashboardData(initialDashboardData);
    
    // Start loading data in the background
    setIsLoadingProfile(true);
    setIsLoadingDashboard(true);
    
    try {
      // First, ensure we have the latest profile data
      const additionalProfileData = await fetchUserProfile(uid);
      if (!additionalProfileData) {
        throw new Error('Failed to fetch profile data');
      }
      
      // Merge additional profile data with login profile data
      const mergedProfileData = {
        ...profileDataFromLogin,
        ...transformUserData(additionalProfileData)
      };
      console.log('Merged profile data:', mergedProfileData);
      setProfileData(mergedProfileData);
      localStorage.setItem('profileData', JSON.stringify(mergedProfileData));

      // Then process recommendation cards progressively
      if (loginData.recommendationCards && Array.isArray(loginData.recommendationCards)) {
        console.log('Processing recommendation cards from login:', loginData.recommendationCards);
        
        // Process each card individually with a delay
        for (const card of loginData.recommendationCards) {
          try {
            const { recommendation_uid, score, queue } = card;
            console.log(`Loading profile for ${recommendation_uid} in queue ${queue} with score ${score}`);
            
            const userProfile = await fetchUserProfile(recommendation_uid);
            if (userProfile) {
              const transformedUser = transformUserData(userProfile);
              const userWithScore = {
                ...transformedUser,
                kundliScore: score !== undefined && score !== null ? score : undefined,
                user_align: card.user_align || false
              };
              
              // Update the appropriate queue with the new user
              setDashboardData(prevData => {
                if (!prevData) return initialDashboardData;
                
                const newData = { ...prevData };
                switch (queue) {
                  case 'RECOMMENDATIONS':
                    newData.recommendations = [...prevData.recommendations, userWithScore];
                    break;
                  case 'MATCHED':
                    newData.matches = [...prevData.matches, userWithScore];
                    break;
                  case 'AWAITING':
                    newData.awaiting = [...prevData.awaiting, userWithScore];
                    break;
                  default:
                    newData.recommendations = [...prevData.recommendations, userWithScore];
                }
                return newData;
              });
              
              // Add a small delay between each card load for animation
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error('Error loading recommendation card:', card, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in handleSuccessfulLogin:', error);
      // If profile fetch fails, at least keep the login data
      setProfileData(profileDataFromLogin);
    } finally {
      setIsLoadingProfile(false);
      setIsLoadingDashboard(false);
    }
  };

  const handleLogout = () => {
    // Clear all cached data
    localStorage.removeItem('userUID');
    localStorage.removeItem('userData');
    localStorage.removeItem('profileData');
    // Note: dashboardData is no longer cached so no need to remove it
    
    // Reset all state
    setIsLoggedIn(false);
    setUserUID(null);
    setProfileData(null);
    setDashboardData(null);
    
    console.log('Session data cleared');
  };

  useEffect(() => {
    // Check for existing login state on app load
    const storedUID = localStorage.getItem('userUID');
    const storedProfileData = localStorage.getItem('profileData');
    // Note: dashboardData is no longer cached
    
    if (storedUID) {
      setUserUID(storedUID);
      setIsLoggedIn(true);
      
      // Load cached profile data if available
      if (storedProfileData) {
        try {
          const parsedProfileData = JSON.parse(storedProfileData);
          setProfileData(parsedProfileData);
          console.log('Profile data loaded from cache');
        } catch (error) {
          console.error('Error parsing cached profile data:', error);
        }
      }
      
      // Dashboard data will be loaded fresh when needed
      console.log('Dashboard data will be loaded fresh on demand');
    }
    setIsLoading(false);
  }, []);

  console.log('Index render - systemNotifications state:', systemNotifications);
  console.log('Index render - systemNotifications length:', systemNotifications.length);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full blur-lg opacity-50"></div>
            <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
            </div>
          </div>
          <p className="text-white/70 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Routes>
        <Route 
          path="/login" 
          element={
            isLoggedIn ? 
            <Navigate to="/dashboard" /> : 
            <Login setIsLoggedIn={setIsLoggedIn} setUserUID={setUserUID} onSuccessfulLogin={handleSuccessfulLogin} />
          } 
        />
        <Route 
          path="/register" 
          element={
            isLoggedIn ? 
            <Navigate to="/dashboard" /> : 
            <Register />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            isLoggedIn ? 
            <Dashboard 
              userUID={userUID} 
              setIsLoggedIn={setIsLoggedIn} 
              onLogout={handleLogout}
              cachedData={dashboardData}
              isLoadingData={isLoadingDashboard}
              notifications={systemNotifications}
            /> : 
            <Navigate to="/login" />
          } 
        />
        <Route 
          path="/profile" 
          element={
            isLoggedIn ? 
            <ProfilePage 
              cachedProfileData={profileData}
              isLoadingProfile={isLoadingProfile}
              onLogout={handleLogout}
            /> : 
            <Navigate to="/login" />
          } 
        />
        <Route 
          path="/matches" 
          element={
            isLoggedIn ? 
            <Matches cachedData={dashboardData?.matches} /> : 
            <Navigate to="/login" />
          } 
        />
        <Route 
          path="/recommendations" 
          element={
            isLoggedIn ? 
            <Recommendations cachedData={dashboardData?.recommendations} /> : 
            <Navigate to="/login" />
          } 
        />
        <Route 
          path="/notifications" 
          element={
            isLoggedIn ? 
            <Notifications cachedData={dashboardData?.notifications} /> : 
            <Navigate to="/login" />
          } 
        />
        <Route 
          path="/awaiting" 
          element={
            isLoggedIn ? 
            <Awaiting cachedData={dashboardData?.awaiting} /> : 
            <Navigate to="/login" />
          } 
        />
        <Route 
          path="/" 
          element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} />} 
        />
      </Routes>
    </div>
  );
};

export default Index;
