// This file acts as the entry point for the MapDisplay component.
// It allows importing '@/components/MapDisplay' and Expo handles platform resolution.

// Note: The underlying platform-specific components (MapDisplay.native.tsx and 
// MapDisplay.web.tsx) likely require a Google Maps API key.
// This key should be provided via the EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 
// environment variable, which is typically read in the parent component 
// (e.g., app/(tabs)/index.tsx) and passed down as the 'apiKey' prop.

// Re-export the native component as the default.
// Expo/Metro will automatically choose MapDisplay.web.tsx for the web platform.
export { default } from './MapDisplay.native'; 