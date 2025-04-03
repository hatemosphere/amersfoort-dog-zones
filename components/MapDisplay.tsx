// This file acts as the entry point for the MapDisplay component.
// It allows proper module resolution for '@/components/MapDisplay'.

// Note: The underlying platform-specific components (MapDisplay.native.tsx and 
// MapDisplay.web.tsx) both require a Google Maps API key.
// This key should be provided via the EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 
// environment variable, which is read in the parent component 
// and passed down as the 'apiKey' prop.

// Use dynamic exports based on platform
import { Platform } from 'react-native';

// Export the appropriate version based on platform
export default Platform.OS === 'web' 
  ? require('./MapDisplay.web').default
  : require('./MapDisplay.native').default; 