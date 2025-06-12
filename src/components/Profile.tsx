import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  Briefcase, 
  Heart,
  Camera,
  Edit,
  Mail,
  Globe,
  Star,
  Sparkles
} from "lucide-react";
import { getSignedS3Url, extractS3Key } from "@/lib/utils";

interface ProfileData {
  uid: string;
  email: string;
  name: string;
  gender?: string;
  city?: string;
  country?: string;
  birth_city?: string;
  birth_country?: string;
  profession?: string;
  dob?: string;
  tob?: string;
  hobbies?: string[];
  images?: string[];
  login?: string;
}

interface ProfileProps {
  onEdit?: () => void;
  cachedProfileData?: ProfileData | null;
  isLoadingProfile?: boolean;
}

const Profile = ({ onEdit, cachedProfileData, isLoadingProfile }: ProfileProps) => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signedImageUrls, setSignedImageUrls] = useState<string[]>([]);

  useEffect(() => {
    // Use cached data if available
    if (cachedProfileData) {
      console.log('Using cached profile data:', cachedProfileData);
      setProfileData(cachedProfileData);
      processImages(cachedProfileData.images || []);
      setIsLoading(false);
      return;
    }

    // Fallback to localStorage if no cached data
    const storedProfileData = localStorage.getItem('profileData');
    if (storedProfileData) {
      try {
        const parsedData = JSON.parse(storedProfileData);
        console.log('Using stored profile data:', parsedData);
        setProfileData(parsedData);
        processImages(parsedData.images || []);
      } catch (error) {
        console.error('Error parsing stored profile data:', error);
      }
    }
    
    setIsLoading(false);
  }, [cachedProfileData]);

  const processImages = async (images: string[]) => {
    if (!images || images.length === 0) return;

    const signedUrls = await Promise.all(
      images.map(async (url) => {
        const key = extractS3Key(url);
        if (key) {
          const signedUrl = await getSignedS3Url(key);
          return signedUrl || url; // Fallback to original URL if signed URL generation fails
        }
        return url;
      })
    );

    setSignedImageUrls(signedUrls);
  };

  // Show loading if we're explicitly loading profile data
  if (isLoadingProfile || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
            <div className="relative w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/70"></div>
            </div>
          </div>
          <p className="text-white/70 font-medium">Loading your amazing profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full border-white/10 bg-white/5 backdrop-blur-xl">
          <CardContent className="p-6 text-center">
            <User className="w-12 h-12 text-white/50 mx-auto mb-4" />
            <p className="text-white/70">No profile data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleEditProfile = () => {
    if (onEdit) {
      onEdit();
    }
  };

  const handleUploadPhotos = () => {
    // This will be handled by the parent component (ProfilePage)
    if (onEdit) {
      onEdit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Enhanced Hero Section */}
        <div className="relative mb-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-pink-600/20 rounded-3xl blur-xl"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-3xl backdrop-blur-3xl border border-white/20"></div>
          
          <div className="relative p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Enhanced Profile Picture */}
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
                <div className="absolute -inset-2 bg-gradient-to-r from-violet-400 to-purple-400 rounded-full blur opacity-20"></div>
                <Avatar className="relative w-36 h-36 md:w-44 md:h-44 ring-4 ring-white/30 shadow-2xl transform group-hover:scale-105 transition-all duration-500">
                  <AvatarImage 
                    src={signedImageUrls[0] || profileData?.images?.[0]} 
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 text-white text-4xl font-bold">
                    {profileData?.name?.charAt(0) || <User className="w-20 h-20" />}
                  </AvatarFallback>
                </Avatar>
                {profileData?.images && profileData.images.length > 1 && (
                  <Badge className="absolute -bottom-2 -right-2 bg-gradient-to-r from-violet-500 to-purple-500 shadow-lg border-0">
                    <Camera className="w-3 h-3 mr-1" />
                    {profileData.images.length}
                  </Badge>
                )}
                <div className="absolute top-2 right-2 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
              </div>

              {/* Enhanced Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8">
                  <div>
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                      <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent">
                        {profileData?.name}
                      </h1>
                      <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                      <Star className="w-5 h-5 text-yellow-400" />
                      <p className="text-xl text-white/80 font-medium">
                        {profileData?.profession || 'Amazing Individual'}
                      </p>
                    </div>
                  </div>
                  {onEdit && (
                    <Button 
                      onClick={handleEditProfile} 
                      size="lg"
                      className="mt-4 md:mt-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                    >
                      <Edit className="w-5 h-5 mr-2" />
                      Edit Profile
                    </Button>
                  )}
                </div>

                {/* Enhanced Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {profileData?.dob && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 group">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="p-2 bg-violet-500/20 rounded-full group-hover:bg-violet-500/30 transition-colors">
                          <Calendar className="w-5 h-5 text-violet-300" />
                        </div>
                        <div>
                          <p className="text-sm text-white/60 font-medium">Age</p>
                          <p className="text-lg font-bold text-white">{calculateAge(profileData.dob)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {profileData?.city && profileData.country && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 group">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-full group-hover:bg-blue-500/30 transition-colors">
                          <MapPin className="w-5 h-5 text-blue-300" />
                        </div>
                        <div>
                          <p className="text-sm text-white/60 font-medium">Location</p>
                          <p className="text-sm font-bold text-white">{profileData.city}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {profileData?.profession && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 group">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-full group-hover:bg-emerald-500/30 transition-colors">
                          <Briefcase className="w-5 h-5 text-emerald-300" />
                        </div>
                        <div>
                          <p className="text-sm text-white/60 font-medium">Career</p>
                          <p className="text-sm font-bold text-white">{profileData.profession}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {profileData?.tob && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 group">
                      <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="p-2 bg-pink-500/20 rounded-full group-hover:bg-pink-500/30 transition-colors">
                          <Clock className="w-5 h-5 text-pink-300" />
                        </div>
                        <div>
                          <p className="text-sm text-white/60 font-medium">Born</p>
                          <p className="text-sm font-bold text-white">{formatTime(profileData.tob)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Enhanced Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Enhanced Personal Information */}
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 hover:shadow-3xl transition-all duration-500 group">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center text-2xl bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                  <div className="p-3 bg-violet-500/20 rounded-xl mr-4 group-hover:bg-violet-500/30 transition-colors">
                    <User className="w-6 h-6 text-violet-300" />
                  </div>
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="w-5 h-5 text-violet-400" />
                      <label className="text-sm font-bold text-violet-200 uppercase tracking-wider">Email</label>
                    </div>
                    <p className="text-lg text-white font-medium">{profileData?.email}</p>
                  </div>
                  
                  {profileData?.gender && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <User className="w-5 h-5 text-pink-400" />
                        <label className="text-sm font-bold text-pink-200 uppercase tracking-wider">Gender</label>
                      </div>
                      <p className="text-lg text-white font-medium capitalize">{profileData.gender}</p>
                    </div>
                  )}

                  {profileData?.dob && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <label className="text-sm font-bold text-blue-200 uppercase tracking-wider">Date of Birth</label>
                      </div>
                      <p className="text-lg text-white font-medium">{new Date(profileData.dob).toLocaleDateString()}</p>
                    </div>
                  )}

                  {profileData?.birth_city && profileData.birth_country && (
                    <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                      <div className="flex items-center gap-3 mb-3">
                        <Globe className="w-5 h-5 text-emerald-400" />
                        <label className="text-sm font-bold text-emerald-200 uppercase tracking-wider">Birth Place</label>
                      </div>
                      <p className="text-lg text-white font-medium">{profileData.birth_city}, {profileData.birth_country}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Photo Gallery with Better Visibility */}
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 hover:shadow-3xl transition-all duration-500 group">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center justify-between text-2xl bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                  <div className="flex items-center">
                    <div className="p-3 bg-violet-500/20 rounded-xl mr-4 group-hover:bg-violet-500/30 transition-colors">
                      <Camera className="w-6 h-6 text-violet-300" />
                    </div>
                    Photo Gallery
                  </div>
                  {profileData?.images && profileData.images.length > 0 && (
                    <Badge variant="secondary" className="bg-gradient-to-r from-violet-500/30 to-purple-500/30 text-white border-violet-400/50 font-semibold">
                      {profileData.images.length} photos
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profileData?.images && profileData.images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {signedImageUrls.map((image, index) => {
                      if (!image || image.length === 0) return null;
                      
                      return (
                        <div key={index} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-800/50 group cursor-pointer transform hover:scale-105 transition-all duration-500 shadow-xl hover:shadow-2xl border border-white/20">
                          {/* Enhanced overlay for better visibility */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                          <div className="absolute bottom-3 left-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <p className="text-white text-sm font-semibold bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1">
                              Photo {index + 1}
                            </p>
                          </div>
                          <img
                            src={image}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center bg-slate-800/70 text-white/80 border border-white/30 rounded-2xl backdrop-blur-xl">
                                    <div class="text-center p-4">
                                      <svg class="w-12 h-12 mx-auto mb-3 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd" />
                                      </svg>
                                      <p class="text-sm font-semibold text-white">Photo ${index + 1}</p>
                                      <p class="text-xs text-white/60 mt-1">Image unavailable</p>
                                    </div>
                                  </div>
                                `;
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center border border-white/20">
                      <Camera className="w-10 h-10 text-violet-400" />
                    </div>
                    <p className="text-white/70 text-lg font-medium">No photos uploaded yet</p>
                    <p className="text-white/50 text-sm mt-2">Share your moments with the world</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Sidebar with Better Interests Visibility */}
          <div className="space-y-8">
            {/* Enhanced Interests & Hobbies with Improved Visibility */}
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 hover:shadow-3xl transition-all duration-500 group">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center text-2xl bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                  <div className="p-3 bg-pink-500/20 rounded-xl mr-4 group-hover:bg-pink-500/30 transition-colors">
                    <Heart className="w-6 h-6 text-pink-300" />
                  </div>
                  Interests & Hobbies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profileData?.hobbies && profileData.hobbies.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {profileData.hobbies.map((hobby, index) => (
                        <Badge 
                          key={index} 
                          className="px-4 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-violet-500/30 to-purple-500/30 text-white border-2 border-violet-400/50 hover:from-violet-500/40 hover:to-purple-500/40 hover:border-violet-400/70 hover:scale-105 transition-all duration-300 cursor-pointer shadow-lg backdrop-blur-xl"
                        >
                          {hobby}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-6 p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl border border-pink-400/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-pink-400" />
                        <span className="text-sm font-semibold text-pink-200">Total Interests</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{profileData.hobbies.length}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center border border-white/20">
                      <Heart className="w-8 h-8 text-pink-400" />
                    </div>
                    <p className="text-white/80 font-semibold text-lg">No interests listed</p>
                    <p className="text-white/60 text-sm mt-2">Add some to let others know what you love</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Quick Actions */}
            <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 hover:shadow-3xl transition-all duration-500 group">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-start bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-2 border-violet-400/50 text-white hover:from-violet-500/30 hover:to-purple-500/30 hover:border-violet-400/70 hover:scale-105 transition-all duration-300 shadow-lg backdrop-blur-xl font-semibold"
                  onClick={handleUploadPhotos}
                >
                  <Camera className="w-5 h-5 mr-3" />
                  Upload Photos
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
