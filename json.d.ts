// Tell TypeScript that importing .json files is okay and what shape they have
declare module "*.json" {
  const value: any; // Use a more specific type if possible, e.g., GeoJsonData
  export default value;
}

// Specific declaration for our filtered dog zones data
declare module "@/assets/data/amersfoort-hondenkaart-filtered.json" {
  import { GeoJsonData } from '@/types';
  const value: GeoJsonData;
  export default value;
} 