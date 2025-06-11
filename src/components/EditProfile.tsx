import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Save, X, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { config } from "../config/api";
import ImageUpload from "./ImageUpload";

interface EditProfileProps {
  onCancel: () => void;
  onSave: () => void;
}

const EditProfile = ({ onCancel, onSave }: EditProfileProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    country: '',
    profession: '',
    birth_city: '',
    birth_country: '',
    dob: '',
    tob: '',
    gender: '',
    hobbies: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsedData = JSON.parse(userData);
        setProfileData(parsedData);
        
        // Set existing images
        const images = parsedData.IMAGES || parsedData.images || [];
        setExistingImages(images);

        // Set form data
        setFormData({
          name: parsedData.NAME || parsedData.name || '',
          phone: parsedData.PHONE || parsedData.phone || '',
          city: parsedData.CITY || parsedData.city || '',
          country: parsedData.COUNTRY || parsedData.country || '',
          profession: parsedData.PROFESSION || parsedData.profession || '',
          birth_city: parsedData.BIRTH_CITY || parsedData.birth_city || '',
          birth_country: parsedData.BIRTH_COUNTRY || parsedData.birth_country || '',
          dob: parsedData.DOB || parsedData.dob || '',
          tob: parsedData.TOB || parsedData.tob || '',
          gender: parsedData.GENDER || parsedData.gender || '',
          hobbies: Array.isArray(parsedData.HOBBIES || parsedData.hobbies) 
            ? (parsedData.HOBBIES || parsedData.hobbies).join(', ')
            : parsedData.HOBBIES || parsedData.hobbies || ''
        });
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const updateProfileAPI = async () => {
    try {
      const userUID = localStorage.getItem('userUID');
      if (!userUID) {
        throw new Error('User UID not found');
      }

      // Create FormData object
      const formDataObj = new FormData();
      
      // Add metadata as JSON string
      const metadata = {
        uid: userUID,
        ...formData,
        hobbies: formData.hobbies.split(',').map(h => h.trim()).filter(h => h)
      };
      formDataObj.append('metadata', JSON.stringify(metadata));

      // Add images
      newImages.forEach((image, index) => {
        formDataObj.append('images', image);
      });

      const response = await fetch(`${config.URL}/account:update`, {
        method: 'POST',
        body: formDataObj
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Profile update response:', result);
      
      return result;
    } catch (error) {
      console.error('Error updating profile via API:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateProfileAPI();
      
      // Update localStorage
      const currentUserData = JSON.parse(localStorage.getItem('userData') || '{}');
      const updatedProfile = {
        ...currentUserData,
        ...formData,
        IMAGES: existingImages,
        images: existingImages
      };
      
      localStorage.setItem('userData', JSON.stringify(updatedProfile));
      
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      
      onSave();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewImagesChange = (images: File[]) => {
    setNewImages(images);
  };

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/80">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center text-white">
            <User className="w-5 h-5 mr-2 text-violet-300" />
            Edit Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Profile Picture */}
            <div className="flex justify-center mb-6">
              <Avatar className="w-24 h-24 ring-4 ring-white/20">
                <AvatarImage src={existingImages?.[0]?.data ? `data:image/jpeg;base64,${existingImages[0].data}` : profileData.images?.[0]} />
                <AvatarFallback className="bg-gradient-to-r from-violet-500 to-purple-500 text-white text-2xl">
                  {profileData.NAME?.charAt(0) || profileData.name?.charAt(0) || <User className="w-8 h-8" />}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-white">Name</Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Phone</Label>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">City</Label>
                <Input
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Country</Label>
                <Input
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Profession</Label>
                <Input
                  name="profession"
                  value={formData.profession}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Gender</Label>
                <Input
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Birth City</Label>
                <Input
                  name="birth_city"
                  value={formData.birth_city}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Birth Country</Label>
                <Input
                  name="birth_country"
                  value={formData.birth_country}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Date of Birth</Label>
                <Input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Time of Birth</Label>
                <Input
                  type="time"
                  name="tob"
                  value={formData.tob}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-white">Hobbies (comma-separated)</Label>
                <Textarea
                  name="hobbies"
                  value={formData.hobbies}
                  onChange={handleInputChange}
                  className="bg-white/10 border-white/20 text-white"
                  placeholder="Enter hobbies separated by commas"
                />
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2">
              <Label className="text-white">Add New Photos</Label>
              <ImageUpload images={newImages} onImagesChange={handleNewImagesChange} />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="border-white/30 text-white hover:bg-white/10"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={isLoading}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditProfile;
