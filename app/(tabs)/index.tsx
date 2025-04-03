import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Alert, Linking, TouchableOpacity, Button, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
// Import turf functions
import * as turf from '@turf/turf'; 
// Use original type imports, rely on casting/wrapping for turf
import { GeoJsonData, Geometry, ZoneStyles, ZoneStyle, ProcessedZone, FeatureProperties } from '@/types'; // Ensure FeatureProperties is imported if needed
import MapDisplay from '@/components/MapDisplay';
// Use the filtered data file (smaller, only GROEN and ORANJE features)
import localDogZonesData from '@/assets/data/amersfoort-hondenkaart-filtered.json';

// --- Constants ---
const MERGE_DISTANCE_METERS = 100; // Max distance for merging areas
const MAX_NEAREST = 5;
const DEFAULT_ZONE_ID_PREFIX = "zone_"; // Prefix for original zone IDs
const MERGED_ZONE_ID_PREFIX = "merged_"; // Prefix for merged zone IDs

// Read API key from environment variables (outside the component)
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// --- Helper Functions ---
/**
 * Calculates the distance between two lat/lng coordinates in kilometers using Haversine formula.
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        0.5 - Math.cos(dLat) / 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Gets a representative coordinate {lat, lng} for distance calculation.
 */
function getCentroid(geometry: Geometry): { lat: number; lng: number } | null {
    if (!geometry || !geometry.coordinates) return null;
    const coords = geometry.coordinates;
    const geomType = geometry.type;
    try {
        if (geomType === "Polygon" && coords && coords[0] && coords[0][0]) {
            return { lat: coords[0][0][1], lng: coords[0][0][0] };
        } else if (geomType === "MultiPolygon" && coords && coords[0] && coords[0][0] && coords[0][0][0]) {
            return { lat: coords[0][0][0][1], lng: coords[0][0][0][0] };
        }
    } catch (error) {
        console.error("Error calculating centroid:", error);
        return null; 
    }
    return null;
}

// Styles - keep both Green/Orange, names can be generic
const zoneStyles: ZoneStyles = {
  GROEN: { 
    fillColor: 'rgba(0, 255, 0, 0.3)', // Polygon fill
    strokeColor: 'rgba(0, 255, 0, 0.8)',
    strokeWidth: 1,
    name: 'Off-leash Zone (Green)' // Generic name
  },
  ORANJE: { 
    fillColor: 'rgba(255, 165, 0, 0.3)', // Polygon fill
    strokeColor: 'rgba(255, 165, 0, 0.8)',
    strokeWidth: 1,
    name: 'Off-leash Zone (Orange)' // Generic name
  },
  DEFAULT: { // Minimal fallback
    fillColor: 'transparent',
    strokeColor: 'transparent',
    strokeWidth: 0,
    name: ''
  },
  // Remove or keep dummy entries based on strictness of ZoneStyles type
  ROOD: { fillColor: '', strokeColor: '', strokeWidth: 0, name: '' }, 
  WIT: { fillColor: '', strokeColor: '', strokeWidth: 0, name: '' },
};

export default function HomeScreen() {
  // State uses ProcessedZone
  const [processedZones, setProcessedZones] = useState<ProcessedZone[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Initializing...');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [nearestZones, setNearestZones] = useState<ProcessedZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ProcessedZone | null>(null);
  const [centerTargetCoords, setCenterTargetCoords] = useState<{ lat: number, lng: number } | null>(null);

  // --- Memo Hooks ---
  const amersfoortRegion = useMemo(() => ({
    latitude: 52.1561,
    longitude: 5.3878,
    latitudeDelta: 0.0922, // Zoom level for Amersfoort
    longitudeDelta: 0.0421,
  }), []);

  const initialWebCenter = useMemo(() => ({ lat: amersfoortRegion.latitude, lng: amersfoortRegion.longitude }), [amersfoortRegion]);
  const initialWebZoom = 13;

  // --- Location Fetching Function ---
  const refreshUserLocation = async (isInitialLoad = false) => {
    console.log("[Location] Refresh triggered.");
    // Don't show loading spinner on subsequent refreshes, only status text
    if (!isInitialLoad) {
         setLocationStatus('Refreshing...'); 
         // Clear previous location briefly to indicate update? Optional.
         // setUserLocation(null); 
    } else {
        setLocationStatus('Requesting...');
    }
    setError(null); // Clear location-related errors

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('Permission denied');
        // Only alert on initial load potentially, or keep alerting?
        // if (isInitialLoad) Alert.alert(...);
        setUserLocation(null); // Ensure location is null if denied
        return; // Stop if permission denied
      }

      setLocationStatus('Fetching...');
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
      setLocationStatus('Granted');
      console.log("[Location] Fetched:", location.coords);

    } catch (locationError) {
      console.error("[Location] Error:", locationError);
      setLocationStatus('Error getting location');
      setUserLocation(null); // Clear location on error
      // setError("Could not fetch location."); // Set main error state if needed
    }
  };

  // --- Effect Hooks ---
  // Effect for initialization and processing data
  useEffect(() => {
    let isMounted = true;
    const initializeApp = async () => {
      try {
        setLoading(true);
        setError(null);
        setLocationStatus('Requesting...');

        // 1. Initial Processing into Raw Zones (Areas & Points)
        const initialAreaZones: ProcessedZone[] = [];
        const initialPointZones: ProcessedZone[] = [];
        
        if (localDogZonesData?.features) {
          const features = (localDogZonesData as GeoJsonData).features;

          for (let i = 0; i < features.length; i++) {
            const feature = features[i];
            const properties = feature.properties;
            const code = properties?.CODE;

            if ((code === "GROEN" || code === "ORANJE") && feature.geometry) {
              const tempId = `${DEFAULT_ZONE_ID_PREFIX}${i}`;
              let area: number | undefined = undefined;
              
              if (properties.OPPERVLAKTE) {
                try {
                  const parsedArea = parseFloat(properties.OPPERVLAKTE);
                  if (!isNaN(parsedArea) && parsedArea > 0) {
                    area = parsedArea;
                  }
                } catch { /* ignore parse error */ }
              }
              
              const centroid = getCentroid(feature.geometry);
              if (!centroid) continue; // Skip if no valid centroid

              const baseZoneData: Partial<ProcessedZone> = {
                type: 'Feature',
                id: tempId,
                properties: properties,
                geometry: feature.geometry,
                geometry_name: feature.geometry_name,
                centroid: centroid
              };

              if (area !== undefined) {
                initialAreaZones.push({...baseZoneData, zoneType: 'area', area: area} as ProcessedZone);
              } else {
                initialPointZones.push({...baseZoneData, zoneType: 'point'} as ProcessedZone);
              }
            }
          }
        }

        console.log(`[Init] Initial processing: ${initialAreaZones.length} area zones, ${initialPointZones.length} point zones.`);

        // 2. Merge Nearby Areas (separately for GROEN and ORANJE)
        const mergeAreas = (areas: ProcessedZone[], codeToMerge: 'GROEN' | 'ORANJE'): ProcessedZone[] => {
          const areasToMerge = areas.filter(z => z.properties.CODE === codeToMerge);
          console.log(`[Merge] Starting merge for ${codeToMerge} areas. Count: ${areasToMerge.length}`);
          
          if (areasToMerge.length < 2) {
            return areasToMerge; // Not enough to merge
          }

          const mergedResult: ProcessedZone[] = [];
          const processedIndices = new Set<number>();

          // For each unprocessed area
          for (let i = 0; i < areasToMerge.length; i++) {
            if (processedIndices.has(i)) continue; // Skip if already processed

            // Start a new group with this area
            const currentAreaIndices = [i];
            let currentMergedArea = {...areasToMerge[i]};
            let currentMergedGeometry = currentMergedArea.geometry;
            
            // Mark as processed
            processedIndices.add(i);

            // Look for nearby areas to merge
            for (let j = i + 1; j < areasToMerge.length; j++) {
              if (processedIndices.has(j)) continue; // Skip if already processed

              try {
                // Create feature objects with explicit type assertions
                const geometry1 = {
                  type: currentMergedGeometry.type === 'Polygon' ? 'Polygon' as const : 'MultiPolygon' as const,
                  coordinates: currentMergedGeometry.coordinates
                };
                
                const geometry2 = {
                  type: areasToMerge[j].geometry.type === 'Polygon' ? 'Polygon' as const : 'MultiPolygon' as const,
                  coordinates: areasToMerge[j].geometry.coordinates
                };
                
                // Wrap in features
                const feature1 = turf.feature(geometry1);
                const feature2 = turf.feature(geometry2);

                // Create buffers around the features
                const buffer1 = turf.buffer(feature1, MERGE_DISTANCE_METERS / 2000); // meters to km
                const buffer2 = turf.buffer(feature2, MERGE_DISTANCE_METERS / 2000); // meters to km

                // Check for proximity
                if (buffer1 && buffer2 && turf.booleanIntersects(buffer1, buffer2)) {
                  // Areas are close enough to merge
                  currentAreaIndices.push(j);
                  processedIndices.add(j);
                  
                  // Sum the areas
                  currentMergedArea.area = (currentMergedArea.area || 0) + (areasToMerge[j].area || 0);
                  
                  // For now, skip the union and just keep the original geometry
                  // Union is causing type issues and needs more complex handling
                }
              } catch (error) {
                console.warn("Error processing geometries:", error);
                // Skip this comparison
              }
            }
            
            // After checking all other areas against the current one
            if (currentAreaIndices.length > 1) {
              // This area was merged with at least one other area
              console.log(`[Merge] Merged ${currentAreaIndices.length} areas of type ${codeToMerge}`);
              
              // Calculate centroid for the merged geometry
              const centroid = getCentroid(currentMergedGeometry);
              if (centroid) {
                // Create a new ProcessedZone for the merged area
                mergedResult.push({
                  ...currentMergedArea,
                  id: `${MERGED_ZONE_ID_PREFIX}${codeToMerge}_${i}`,
                  geometry: currentMergedGeometry,
                  centroid: centroid
                });
              } else {
                // Fallback: just use the centroid of the first area
                mergedResult.push({
                  ...currentMergedArea,
                  id: `${MERGED_ZONE_ID_PREFIX}${codeToMerge}_${i}`
                });
              }
            } else {
              // This area wasn't merged with any other, add it as is
              mergedResult.push(currentMergedArea);
            }
          }

          return mergedResult;
        };

        // Merge areas by type
        const mergedGreenAreas = mergeAreas([...initialAreaZones], 'GROEN');
        const mergedOrangeAreas = mergeAreas([...initialAreaZones], 'ORANJE');
        
        // Combine the results
        const allProcessedZones = [
          ...mergedGreenAreas,
          ...mergedOrangeAreas,
          ...initialPointZones
        ];
        
        if (isMounted) {
          setProcessedZones(allProcessedZones);
          console.log(`[Init] Final zones count: ${allProcessedZones.length}`);
        }

        // Initial Location Fetch
        await refreshUserLocation(true);

      } catch (e) {
        console.error("Failed to initialize app:", e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Unknown error occurred");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeApp();
    return () => { isMounted = false; };
  }, []);

  // Effect to calculate nearest zones
  useEffect(() => {
      if (userLocation && processedZones.length > 0) {
           console.log("[Nearest] Calculating distances...");
           const zonesWithDistance = processedZones.map(zone => ({
               ...zone,
               distance: getDistance(
                   userLocation.coords.latitude, 
                   userLocation.coords.longitude,
                   zone.centroid.lat, 
                   zone.centroid.lng
               )
           }));
           zonesWithDistance.sort((a, b) => a.distance! - b.distance!); // Added non-null assertion
           setNearestZones(zonesWithDistance.slice(0, MAX_NEAREST));
      }
  }, [userLocation, processedZones]); 

  // Effect to update selected zone distance
  useEffect(() => {
      if (selectedZone && userLocation) {
          console.log("[Selected] Updating distance for selected zone...");
          const distance = getDistance(
              userLocation.coords.latitude,
              userLocation.coords.longitude,
              selectedZone.centroid.lat,
              selectedZone.centroid.lng
          );
          // Ensure selectedZone is updated correctly
          setSelectedZone(prevZone => prevZone ? ({ ...prevZone, distance: distance }) : null);
      }
  }, [userLocation, selectedZone]);

  // --- Early Returns (AFTER all hooks) ---
  if (loading) {
    return (
      <View style={styles.centeredView}>
        <ActivityIndicator size="large" />
        <Text>Initializing...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centeredView}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  // --- Component Logic & Render (AFTER hooks and early returns) ---
  const getFeatureStyle = (feature: ProcessedZone): ZoneStyle => {
     const code = feature.properties?.CODE;
     if (code === 'GROEN') return zoneStyles.GROEN;
     if (code === 'ORANJE') return zoneStyles.ORANJE;
     return zoneStyles.DEFAULT; // Fallback
  };

  /**
   * Formats geometry coordinates for map display.
   * More robust handling of Polygon and MultiPolygon types.
   */
  const formatCoordinates = (geometry: Geometry): { latitude: number; longitude: number }[] => {
    if (!geometry?.coordinates) return [];
    const coords: any = geometry.coordinates;

    if (geometry.type === 'Polygon') {
      // Handle Polygon - use the outer ring (first array of coordinates)
      // Check if coords[0] exists and has elements
      if (Array.isArray(coords[0])) {
        return coords[0]
          .map((coord: number[]) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              return { latitude: coord[1], longitude: coord[0] };
            }
            return null;
          })
          .filter((coord): coord is { latitude: number; longitude: number } => coord !== null); // Type guard
      }
    } else if (geometry.type === 'MultiPolygon') {
      // Handle MultiPolygon - flatten all polygon outer rings into one array
      const flattenedCoords: { latitude: number; longitude: number }[] = [];
      
      // Iterate through all polygons in the MultiPolygon
      if (Array.isArray(coords)) {
        coords.forEach((polygon: any) => {
          // Get the outer ring of each polygon (first array of coordinates)
          if (Array.isArray(polygon) && Array.isArray(polygon[0])) {
            polygon[0].forEach((coord: number[]) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                flattenedCoords.push({ latitude: coord[1], longitude: coord[0] });
              }
            });
          }
        });
      }
      
      return flattenedCoords;
    }
    
    return [];
  };

  // --- Log selection & Set Center Target ---
  const handleZoneSelection = (zone: ProcessedZone | null, fromList: boolean = false) => {
      console.log(`[Selection] Zone selected via ${zone ? (fromList? 'list' : 'map') : 'cleared'}. ID: ${zone?.id}`);
      
      // Calculate distance if we have both user location and zone
      if (zone && userLocation) {
          const distance = getDistance(
              userLocation.coords.latitude,
              userLocation.coords.longitude,
              zone.centroid.lat,
              zone.centroid.lng
          );
          zone.distance = distance;
      }
      
      setSelectedZone(zone);
      // Set center target ONLY if selected from the list
      if (zone && fromList && zone.centroid) {
           console.log("[Center] Setting center target from list selection:", zone.centroid);
           setCenterTargetCoords(zone.centroid); 
      } else if (!zone) {
           // Optionally clear target when selection is cleared? Or keep map position?
           // setCenterTargetCoords(null);
      }
  };

  // --- Navigation Handler (keep simplified onPress for now) ---
  const handleNavigationRequest = async (zone: ProcessedZone) => {
      if (!zone.centroid) return;
      const { lat, lng } = zone.centroid;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      console.log("[Navigation] Generated URL:", url);

      // --- Platform Specific Navigation Handling ---
      if (Platform.OS === 'web') {
         // On web, skip the Alert and open directly
         console.log("[Navigation] Web platform detected. Attempting direct Linking.openURL...");
         try {
            // On web, canOpenURL might not be reliable for external links, try opening directly
            await Linking.openURL(url);
            console.log("[Navigation] Linking.openURL finished for web.");
         } catch (error) {
            console.error("[Navigation] Error during Linking on web:", error);
            Alert.alert("Navigation Error", "Could not open the map link in a new tab.");
         }
      } else {
         // On native (iOS/Android), use the confirmation Alert
         Alert.alert(
             "Start Navigation?",
             `Do you want to navigate to the selected area?`, 
             [
                 { text: "Cancel", style: "cancel" },
                 { 
                     text: "OK", 
                     onPress: async () => { 
                         console.log("[Navigation] Native OK pressed. Checking URL support..."); 
                         try {
                             const supported = await Linking.canOpenURL(url);
                             console.log("[Navigation] Linking.canOpenURL result:", supported); 
                             if (supported) {
                                 console.log("[Navigation] Attempting Linking.openURL...");
                                 await Linking.openURL(url);
                                 console.log("[Navigation] Linking.openURL finished."); 
                             } else {
                                 console.error(`[Navigation] Cannot open URL: ${url}`);
                                 Alert.alert(`Cannot Open URL`, `Your device cannot open the required map link.`);
                             }
                         } catch (error) {
                              console.error("[Navigation] Error during Linking:", error);
                              Alert.alert("Navigation Error", "An error occurred while trying to open the map link.");
                         }
                     }
                 }
             ]
         );
      }
  };

  // --- Center Map Handler - Sets Target Coords ---
  const centerOnUser = () => {
    if (userLocation?.coords) {
        console.log("[Center] Setting center target to user location.")
        setCenterTargetCoords({ lat: userLocation.coords.latitude, lng: userLocation.coords.longitude });
        // Remove trigger increment
        // setCenterMapTrigger(prev => prev + 1); 
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <MapDisplay 
        initialRegion={amersfoortRegion}
        showsUserLocation={locationStatus === 'Granted'}
        getFeatureStyle={getFeatureStyle}
        formatCoordinates={formatCoordinates}
        apiKey={GOOGLE_MAPS_API_KEY}
        initialCenter={initialWebCenter}
        initialZoom={initialWebZoom}
        processedZones={processedZones}
        zoneStyles={zoneStyles as ZoneStyles} 
        userLocation={userLocation ? { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude } : undefined}
        onZoneSelect={(zone: ProcessedZone) => handleZoneSelection(zone, false)}
        selectedZoneId={selectedZone?.id}
        centerTargetCoords={centerTargetCoords}
      />

      {/* Controls Overlay (Refresh & Center) */}
      <View style={styles.controlsContainer}>
         <Button title="Refresh Location" onPress={() => refreshUserLocation(false)} disabled={locationStatus === 'Fetching...' || locationStatus === 'Refreshing...'} />
         {userLocation && (
             <Button title="Center on Me" onPress={centerOnUser} />
         )}
         {/* Display location status for debugging */}
         {/* <Text style={{fontSize: 10, textAlign: 'center'}}>Status: {locationStatus}</Text> */} 
      </View>

      {/* Updated Legend - Might need Point legend items re-added if removed */} 
       <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
             <View style={[styles.legendColorBox, { backgroundColor: zoneStyles.GROEN.fillColor }]} />
             <Text style={styles.legendText}>{zoneStyles.GROEN.name} (Area)</Text>
          </View>
          <View style={styles.legendItem}>
             <View style={[styles.legendColorBox, { backgroundColor: zoneStyles.ORANJE.fillColor }]} /> 
             <Text style={styles.legendText}>{zoneStyles.ORANJE.name} (Area)</Text>
          </View>
           <View style={styles.legendItem}>
             <View style={[styles.legendColorBox, { backgroundColor: zoneStyles.GROEN.strokeColor, borderRadius: 10 }]} /> 
             <Text style={styles.legendText}>{zoneStyles.GROEN.name} (Point)</Text>
          </View>
          <View style={styles.legendItem}>
             <View style={[styles.legendColorBox, { backgroundColor: zoneStyles.ORANJE.strokeColor, borderRadius: 10 }]} /> 
             <Text style={styles.legendText}>{zoneStyles.ORANJE.name} (Point)</Text>
          </View>
       </View>

      {/* Nearest Zones Overlay - Update Text Rendering (Check non-null assertions) */}
      {nearestZones.length > 0 && (
          <View style={styles.nearestContainer}>
              <Text style={styles.nearestTitle}>Nearest Off-Leash Zones:</Text>
              {nearestZones.map(zone => (
                  <TouchableOpacity key={zone.id} onPress={() => handleZoneSelection(zone, true)}> 
                     <Text style={[styles.nearestItem, selectedZone?.id === zone.id && styles.selectedItem]}>
                         {zone.distance != null ? `(~${(zone.distance * 1000).toFixed(0)}m)` : '(Dist. N/A)'}
                         {zone.zoneType === 'area' && zone.area != null &&
                            ` - Area: ${zone.area.toFixed(0)} m²`
                         }
                         {` (${zone.properties.CODE})`}
                     </Text>
                  </TouchableOpacity>
              ))}
          </View>
      )}
      
      {/* Navigation Prompt - Update Text Rendering (Check non-null assertions) */}
      {selectedZone && (
          <View style={styles.navigationPrompt}>
              <Text style={styles.promptText}>
                  Navigate to selected zone?
                  {selectedZone.distance != null ? ` (${(selectedZone.distance * 1000).toFixed(0)}m away)` : ''}
                  {selectedZone.area != null ? ` (Area: ${selectedZone.area.toFixed(0)} m²)` : ''}
              </Text>
             <View style={styles.promptButtons}>
                 <Button title="Go" onPress={() => handleNavigationRequest(selectedZone)} />
                 <Button title="Cancel" onPress={() => handleZoneSelection(null)} color="#888"/>
             </View>
          </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Styles for Nearest Areas List
  nearestContainer: {
      position: 'absolute',
      bottom: 85, 
      left: 10,
      right: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: 10,
      borderRadius: 5,
      elevation: 3,
      maxHeight: '35%', 
  },
  nearestTitle: {
      fontWeight: 'bold',
      marginBottom: 5,
      fontSize: 14,
  },
  nearestItem: {
      fontSize: 13,
      marginBottom: 3,
      paddingVertical: 2, // Make items easier to tap
  },
  selectedItem: {
     backgroundColor: '#e0e0ff', // Highlight selected item
     fontWeight: 'bold',
  },
  // Styles for Navigation Prompt
  navigationPrompt: {
       position: 'absolute',
       bottom: 10,
       left: 10,
       right: 10,
       backgroundColor: '#d0f0d0',
       padding: 12,
       borderRadius: 5,
       elevation: 4,
       alignItems: 'center',
  },
  promptText: {
      marginBottom: 8,
      fontSize: 14,
      textAlign: 'center',
  },
  promptButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '80%',
  },
  // Style for the new controls container
  controlsContainer: {
      position: 'absolute',
      top: 10, 
      left: 10,
      right: 10,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      paddingVertical: 5,
      borderRadius: 5,
      elevation: 2,
  },
  // Re-add Legend styles
  legendContainer: {
      position: 'absolute',
      top: 60, // Below controls
      left: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      padding: 8,
      borderRadius: 5,
      elevation: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColorBox: {
    width: 15,
    height: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  legendText: {
    fontSize: 12,
  },
});
