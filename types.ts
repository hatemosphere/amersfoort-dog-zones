// Keep custom FeatureProperties
export interface FeatureProperties {
  OPPERVLAKTE: string | null;
  WIJKNAAM: string | null;
  CODE: string; // e.g., "ROOD", "GROEN", "ORANJE", "WIT"
  GEBIEDSTEAM: string | null;
  ID: number;
}

// Use a flexible Geometry type compatible with GeoJSON
export interface Geometry {
  type: string; // e.g., 'Polygon', 'MultiPolygon'
  coordinates: any; // Coordinates structure depends on the type
}

// Define our Feature structure 
export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  // Restore geometry_name as potentially required if MapDisplay needs it, 
  // or adjust MapDisplay if it doesn't.
  // For now, reverting to original definition found earlier.
  geometry_name: string; 
  properties: FeatureProperties;
}

// Define the FeatureCollection
export interface GeoJsonData {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  // Add other top-level properties if needed (e.g., totalFeatures, crs)
}

// Define the structure of a single zone style
export interface ZoneStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  name: string;
}

// Define the type for the collection of zone styles
export interface ZoneStyles {
  ROOD: ZoneStyle;
  GROEN: ZoneStyle;
  ORANJE: ZoneStyle;
  WIT: ZoneStyle;
  DEFAULT: ZoneStyle;
  [key: string]: ZoneStyle; // Allow index signature for dynamic access
}

// Modified ProcessedZone interface from before merging
export interface ProcessedZone extends GeoJsonFeature {
    zoneType: 'area' | 'point'; // Distinguish based on valid area
    centroid: { lat: number; lng: number }; // Centroid required
    area?: number; // Area optional (present for 'area' type)
    distance?: number; // Distance from user (calculated later)
    // properties is inherited from GeoJsonFeature
} 