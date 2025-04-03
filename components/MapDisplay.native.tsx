import React, { useRef, useEffect, memo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import MapView, { Polygon, Marker, Circle, LatLng, Region } from 'react-native-maps';
import { ProcessedZone, FeatureProperties } from '@/types';
import { Feature, Point, Polygon as GeoJsonPolygon, MultiPolygon as GeoJsonMultiPolygon, Position } from 'geojson';

// --- Interfaces ---
interface MapDisplayProps {
  userLocation: { coords: { latitude: number; longitude: number; accuracy: number | null } } | null;
  processedZones: ProcessedZone[];
  onZoneSelect: (zone: ProcessedZone) => void;
  selectedZoneId: string | null;
  // Replace centerMapTrigger with centerTargetCoords
  // centerMapTrigger: number;
  centerTargetCoords: { lat: number, lng: number } | null;
  getFeatureStyle: (feature: ProcessedZone, isSelected: boolean) => { fillColor: string; strokeColor: string; strokeWidth: number; zIndex?: number; opacity?: number };
}

// --- Component ---
const MapDisplay: React.FC<MapDisplayProps> = memo(
  ({
    userLocation,
    processedZones,
    onZoneSelect,
    selectedZoneId,
    // centerMapTrigger, // remove
    centerTargetCoords, // add
    getFeatureStyle,
  }) => {
    const mapRef = useRef<MapView>(null);
    const initialRegionSet = useRef(false);

    // --- Effects ---

    // Effect to center map based on centerTargetCoords prop
    useEffect(() => {
        if (centerTargetCoords && mapRef.current) {
            console.log("[Native Map] Animating to target coords:", centerTargetCoords);
            const region: Region = {
                latitude: centerTargetCoords.lat,
                longitude: centerTargetCoords.lng,
                latitudeDelta: 0.01, // Zoom level
                longitudeDelta: 0.01,
            };
            mapRef.current.animateToRegion(region, 500); // Animate over 500ms
        }
    }, [centerTargetCoords]); // Re-run only when centerTargetCoords changes

    // Effect to set initial region or center on user when location updates *initially*
    useEffect(() => {
      if (userLocation && mapRef.current && !initialRegionSet.current) {
        console.log("[Native Map] Setting initial region based on user location.");
        const { latitude, longitude } = userLocation.coords;
        const region: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.04, // Slightly wider initial view
          longitudeDelta: 0.04,
        };
        mapRef.current.animateToRegion(region, 500);
        initialRegionSet.current = true;
      }
      // Not dependent on centerTargetCoords
    }, [userLocation]);

    // --- Render --- //
    return (
        <MapView
            ref={mapRef}
            style={styles.map}
            // provider={PROVIDER_GOOGLE} // Optional: Use Google Maps on iOS
            showsUserLocation={true}
            showsMyLocationButton={false} // We have a custom button
            initialRegion={{
                latitude: 52.1561,
                longitude: 5.3878,
                latitudeDelta: 0.15,
                longitudeDelta: 0.15,
            }}
        >
            {/* Render Zones (Polygons or Markers) */}
            {processedZones.map((feature) => {
                const isSelected = feature.id === selectedZoneId;
                const style = getFeatureStyle(feature, isSelected);

                if (feature.zoneType === 'area' && feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                    // Ensure coordinates are in the correct LatLng format for react-native-maps
                    const coordinatesArray = feature.geometry.type === 'Polygon'
                        ? [feature.geometry.coordinates[0].map((coord: Position) => ({ latitude: coord[1], longitude: coord[0] }))]
                        : feature.geometry.coordinates.map((poly: Position[][]) => poly[0].map((coord: Position) => ({ latitude: coord[1], longitude: coord[0] })));

                    return coordinatesArray.map((coordinates: LatLng[], index: number) => (
                         <Polygon
                            key={`${feature.id}-poly-${index}`}
                            coordinates={coordinates}
                            fillColor={style.fillColor}
                            strokeColor={style.strokeColor}
                            strokeWidth={style.strokeWidth}
                            tappable={true}
                            onPress={() => onZoneSelect(feature)}
                            zIndex={style.zIndex ?? 1} // Ensure selected is on top
                        />
                    ));
                } else if (feature.zoneType === 'point' && feature.centroid) {
                    const markerColor = style.fillColor === 'rgba(255, 165, 0, 0.5)' ? 'orange' : 'green'; // Determine marker color
                    
                    // Cast properties to 'any' to access specific fields
                    const props = feature.properties as any; 
                    const title = `Zone ${props?.OBJECTID ?? feature.id}`;
                    const description = props?.NAAM ?? 'Dog Zone';
                    
                    return (
                        <Marker
                            key={`${feature.id}-marker`}
                            coordinate={{ latitude: feature.centroid.lat, longitude: feature.centroid.lng }}
                            title={title}
                            description={description}
                            pinColor={markerColor}
                            onPress={() => onZoneSelect(feature)}
                             zIndex={style.zIndex ?? 1}
                        />
                    );
                }
                return null;
            })}

            {/* Optional: User Accuracy Circle */}
            {userLocation?.coords.accuracy && (
                <Circle
                    center={{
                        latitude: userLocation.coords.latitude,
                        longitude: userLocation.coords.longitude,
                    }}
                    radius={userLocation.coords.accuracy}
                    strokeColor="rgba(0, 150, 255, 0.5)"
                    fillColor="rgba(0, 150, 255, 0.2)"
                />
            )}
        </MapView>
    );
  }
);

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default MapDisplay; 