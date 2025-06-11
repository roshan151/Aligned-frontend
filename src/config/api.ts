export const config = {
  URL: 'https://lovebhagya.com',
  PROFILE_URL: 'http://localhost:8080',
  MAX_IMAGES: 5,
  ENDPOINTS: {
    CREATE_ACCOUNT: '/account:create',
    VERIFY_EMAIL: '/verify:email',
    GET_PROFILE: '/get:profile',
    FIND_PROFILE: '/get:profile',
    UPDATE_PROFILE: '/update:profile'
  }
};

// Configure fetch to work with HTTPS in production
if (import.meta.env.DEV) {
  // For development, we'll handle CORS and HTTPS requests
  console.log('Development mode: Using HTTPS backend at', config.URL);
  console.log('Profile API at', config.PROFILE_URL);
}
