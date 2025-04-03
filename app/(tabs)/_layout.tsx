import { Slot } from 'expo-router';

// This layout now simply renders the currently matched child screen 
// within this directory (index.tsx) using Slot.
// This avoids adding the Stack navigator layer when only one screen is present
// and might resolve issues with component re-renders.
export default function TabLayout() {
  return <Slot />;
}
