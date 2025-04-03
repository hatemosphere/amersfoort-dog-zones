import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { GeoJsonData, GeoJsonFeature, Geometry, ZoneStyles, ZoneStyle, ProcessedZone } from '../types';
import { Feature, Point, Polygon, MultiPolygon, Position } from 'geojson';

// Helper function to convert GeoJSON coordinates to LatLngLiteral for web map
const formatWebCoordinates = (geometry: Geometry): google.maps.LatLngLiteral[][] => {
  if (!geometry || !geometry.coordinates) return [];
  if (geometry.type === 'Polygon') {
    const path = geometry.coordinates[0].map((coord: number[]) => ({ lat: coord[1], lng: coord[0] }));
    return [path];
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((polygonCoords: number[][][]) =>
      polygonCoords[0].map((coord: number[]) => ({ lat: coord[1], lng: coord[0] }))
    );
  }
  return [];
};

// Convert RGBA to Hex and Alpha for Google Maps
function rgbaToHex(rgba: string): { color: string; opacity: number } {
    const result = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(rgba);
    if (!result) return { color: '#000000', opacity: 1 }; // Default fallback

    const r = parseInt(result[1], 10);
    const g = parseInt(result[2], 10);
    const b = parseInt(result[3], 10);
    const alpha = result[4] !== undefined ? parseFloat(result[4]) : 1;

    const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    
    return { color: hex, opacity: alpha };
}

// --- Interfaces ---
interface MapDisplayProps {
    apiKey: string;
    // Ensure userLocation includes accuracy here
    userLocation: { lat: number; lng: number; accuracy: number | null } | null; 
    processedZones: ProcessedZone[];
    onZoneSelect: (zone: ProcessedZone) => void;
    selectedZoneId: string | null;
    centerTargetCoords: { lat: number, lng: number } | null;
    // Define the return type accurately based on index.tsx implementation
    getFeatureStyle: (feature: ProcessedZone, isSelected: boolean) => { 
        fillColor: string; 
        strokeColor: string; 
        strokeWidth: number; 
        zIndex?: number; 
        opacity?: number 
    }; 
}

// Internal component to handle map interactions after API is loaded
const WebMap = memo(({ 
    userLocation, 
    processedZones,
    onZoneSelect, 
    selectedZoneId, 
    centerTargetCoords, 
    getFeatureStyle 
}: Omit<MapDisplayProps, 'apiKey'>) => {
    const map = useMap();
    const [drawnPolygons, setDrawnPolygons] = useState<google.maps.Polygon[]>([]);
    const initialCenterSet = useRef(false);
    // Ref to store polygon click listener handles
    const polygonListenersRef = useRef<google.maps.MapsEventListener[]>([]); 

    // Function to convert style for Google Maps Polygon
    const getWebPolygonStyleOptions = (feature: ProcessedZone, isSelected: boolean): google.maps.PolygonOptions => {
        const baseStyle = getFeatureStyle(feature, isSelected);
        const fillColorData = rgbaToHex(baseStyle.fillColor);
        const strokeColorData = rgbaToHex(isSelected ? '#0000FF' : baseStyle.strokeColor); // Blue outline if selected

        return {
            strokeColor: strokeColorData.color,
            strokeOpacity: isSelected ? 1.0 : (strokeColorData.opacity ?? (baseStyle.opacity ?? 0.8)), 
            strokeWeight: isSelected ? baseStyle.strokeWidth + 1 : baseStyle.strokeWidth, 
            fillColor: fillColorData.color,
            fillOpacity: fillColorData.opacity * (isSelected ? 0.7 : 0.5), 
            zIndex: isSelected ? 10 : (baseStyle.zIndex ?? 1), 
            clickable: true,
        };
    };
    
    // --- Effects --- //
    
    // Effect to center map based on centerTargetCoords prop
    useEffect(() => {
        if (centerTargetCoords && map) {
            console.log("[Web Map] Panning to target coords:", centerTargetCoords);
            map.panTo(centerTargetCoords);
            map.setZoom(17); // Zoom in when centering on a specific zone
        }
    }, [centerTargetCoords, map]); // Re-run when coords or map instance changes

    // Effect for initial centering and drawing polygons/markers
    useEffect(() => {
        if (!map) return;

        // Center map initially on user location if available and not already centered
        if (userLocation && !initialCenterSet.current) {
            console.log("[Web Map] Panning to initial user location.");
            map.panTo({ lat: userLocation.lat, lng: userLocation.lng });
            map.setZoom(14); // Initial zoom level
            initialCenterSet.current = true;
        }

        // --- Polygon Drawing --- // 
        
        // 1. Clean up previous polygons AND listeners first
        console.log(`[Web Map Effect] Cleaning up ${polygonListenersRef.current.length} listeners and ${drawnPolygons.length} polygons.`);
        polygonListenersRef.current.forEach(listener => listener.remove());
        polygonListenersRef.current = []; // Clear the listeners array
        drawnPolygons.forEach(p => p.setMap(null));
        
        // 2. Prepare new polygons and listeners
        const newPolygons: google.maps.Polygon[] = [];
        const newListeners: google.maps.MapsEventListener[] = [];

        // Draw polygons for 'area' type zones
        processedZones.forEach((feature) => {
            if (feature.zoneType !== 'area' || !feature.geometry || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
                return; 
            }

            const isSelected = feature.id === selectedZoneId;
            const styleOptions = getWebPolygonStyleOptions(feature, isSelected);
            
            const paths = feature.geometry.type === 'Polygon'
                ? [feature.geometry.coordinates[0].map((coord: Position): google.maps.LatLngLiteral => ({ lat: coord[1], lng: coord[0] }))]
                : feature.geometry.coordinates.map((poly: Position[][]): google.maps.LatLngLiteral[] => poly[0].map((coord: Position): google.maps.LatLngLiteral => ({ lat: coord[1], lng: coord[0] })));

            paths.forEach((path: google.maps.LatLngLiteral[]) => {
                const polygon = new google.maps.Polygon(styleOptions);
                polygon.setPaths(path);
                polygon.setMap(map);

                // Add listener and store its handle
                const listener = google.maps.event.addListener(polygon, 'click', () => {
                    console.log(`[WebMap Click] Polygon ${feature.id} clicked.`); // Keep click log
                    onZoneSelect(feature);
                });
                newListeners.push(listener); // Add to temporary array
                newPolygons.push(polygon); // Add polygon to temporary array
            });
        });
        
        // 3. Update state and refs
        console.log(`[Web Map Effect] Setting ${newListeners.length} listeners and ${newPolygons.length} polygons.`);
        setDrawnPolygons(newPolygons);
        polygonListenersRef.current = newListeners; // Update the ref with new listeners

        // --- Cleanup Function for this Effect --- //
        // This runs when dependencies change OR component unmounts
        return () => {
            console.log(`[Web Map Effect Cleanup] Removing ${polygonListenersRef.current.length} listeners and ${newPolygons.length} polygons.`);
            // Remove listeners associated with the polygons being replaced/unmounted
            polygonListenersRef.current.forEach(listener => listener.remove()); 
            polygonListenersRef.current = []; // Ensure ref is cleared on unmount/dep change
            // Remove polygons from the map
            newPolygons.forEach(p => p.setMap(null));
        };
    }, [map, processedZones, selectedZoneId, getFeatureStyle, onZoneSelect, userLocation]); 

    // Calculate points separately for Marker rendering
    const pointsToRender = useMemo(() => {
        return processedZones.filter(zone => zone.zoneType === 'point' && zone.centroid);
    }, [processedZones]);

    // --- Render --- //
    return (
        <>
            {/* User Location Marker */}
            {userLocation && (
                 <AdvancedMarker position={userLocation} title={"Your Location"}>
                     <Pin background={'#007bff'} borderColor={'#0056b3'} glyphColor={'#ffffff'} />
                 </AdvancedMarker>
             )}

            {/* Accuracy Circle */}
            {userLocation && userLocation.accuracy && map && (
                <CircleComponent 
                    center={userLocation}
                    radius={userLocation.accuracy}
                    strokeColor="#007bff"
                    strokeOpacity={0.6}
                    strokeWeight={1}
                    fillColor="#007bff"
                    fillOpacity={0.1}
                />
            )}

            {/* Zone Point Markers */}
             {pointsToRender.map(point => {
                const isSelected = point.id === selectedZoneId;
                const style = getFeatureStyle(point, isSelected);
                if (!point.centroid) return null; 
                const props = point.properties as any; // Cast for OBJECTID
                const title = `Zone ${props?.OBJECTID ?? point.id}`; 

                // Define base and selected styles for the marker div
                const markerStyle: React.CSSProperties = {
                    width: isSelected ? '16px' : '12px',
                    height: isSelected ? '16px' : '12px',
                    backgroundColor: style.fillColor, 
                    borderRadius: '50%',
                    border: isSelected ? '2px solid #0000FF' : '1px solid #333', // Blue border if selected
                    cursor: 'pointer',
                    transition: 'all 0.1s ease-in-out', 
                };

                return (
                    <AdvancedMarker
                        key={point.id}
                        position={point.centroid}
                        title={title} 
                        clickable={true}
                        onClick={() => onZoneSelect(point)}
                        zIndex={isSelected ? 10 : 5} 
                    >
                       <div style={markerStyle}></div>
                    </AdvancedMarker>
                );
            })}
        </>
    );
});

// Export the Web Map display component
const MapDisplay: React.FC<MapDisplayProps> = ({ apiKey, ...props }) => {
  if (!apiKey || apiKey === "YOUR_WEB_GOOGLE_MAPS_API_KEY") {
      return <div style={{ padding: '20px', textAlign: 'center' }}>Please provide a valid Google Maps API Key for the web version.</div>;
  }
  return (
    <APIProvider apiKey={apiKey}>
        <Map
            mapId={'amersfoortDogZonesMap'} 
            style={{ width: '100%', height: '100%' }}
            defaultCenter={{ lat: 52.1561, lng: 5.3878 }}
            defaultZoom={13}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
        >
            <WebMap {...props} /> 
        </Map>
    </APIProvider>
  );
};

// --- Circle Component --- //
interface CircleComponentProps {
    center: { lat: number; lng: number };
    radius: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
}

const CircleComponent: React.FC<CircleComponentProps> = ({ center, radius, ...options }) => {
    const map = useMap();
    const circleRef = useRef<google.maps.Circle | null>(null);

    useEffect(() => {
        if (!map) return;

        if (!circleRef.current) {
            circleRef.current = new google.maps.Circle({
                map,
                center,
                radius,
                ...options,
            });
        } else {
            // Update existing circle
            circleRef.current.setCenter(center);
            circleRef.current.setRadius(radius);
            circleRef.current.setOptions(options);
        }

        // Cleanup
        return () => {
            if (circleRef.current) {
                // console.log("[Web Map] Cleaning up circle");
                circleRef.current.setMap(null);
                circleRef.current = null; // Important to allow recreation if map instance changes
            }
        };
    }, [map, center, radius, options]);

    return null; // Circle is drawn directly on the map, no React element needed
};

export default MapDisplay; 