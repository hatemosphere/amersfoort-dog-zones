// find_largest_orange_zones.js
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const JSON_FILE_PATH = path.join("assets", "data", "amersfoort-hondenkaart.json");
const TARGET_CODE = "ORANJE";
const NUMBER_TO_REPORT = 5; // How many of the largest areas to report
// ---

/**
 * Extracts the first coordinate pair [longitude, latitude] from a
 * Polygon or MultiPolygon geometry.
 * @param {object | null} geometry - The GeoJSON geometry object.
 * @returns {number[] | null} - An array [longitude, latitude] or null.
 */
function getRepresentativeCoordinate(geometry) {
    if (!geometry || !geometry.coordinates) {
        return null;
    }

    const coords = geometry.coordinates;
    const geomType = geometry.type;

    try {
        if (geomType === "Polygon") {
            // Polygon: [[[lng, lat], ...]]
            if (coords && coords[0] && coords[0][0] && coords[0][0].length === 2) {
                return coords[0][0]; // [lng, lat]
            }
        } else if (geomType === "MultiPolygon") {
            // MultiPolygon: [[[[lng, lat], ...]], ...]
            if (coords && coords[0] && coords[0][0] && coords[0][0][0] && coords[0][0][0].length === 2) {
                return coords[0][0][0]; // First coordinate of the first polygon
            }
        }
    } catch (e) {
        // Log potential errors during coordinate extraction if needed
        // console.warn(`Warning: Could not extract coordinate from geometry. Error: ${e}`);
        return null;
    }
    return null;
}

function main() {
    if (!fs.existsSync(JSON_FILE_PATH)) {
        console.error(`Error: JSON file not found at ${JSON_FILE_PATH}`);
        console.error("Please ensure you have downloaded the file and placed it correctly.");
        process.exit(1); // Exit with error code
    }

    let rawData;
    try {
        rawData = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
    } catch (e) {
        console.error(`Error reading file ${JSON_FILE_PATH}: ${e.message}`);
        process.exit(1);
    }

    let data;
    try {
        data = JSON.parse(rawData);
    } catch (e) {
        console.error(`Error: Could not decode JSON from ${JSON_FILE_PATH}: ${e.message}`);
        process.exit(1);
    }

    if (typeof data !== 'object' || data === null || !Array.isArray(data.features)) {
        console.error("Error: JSON data does not seem to be a valid GeoJSON FeatureCollection.");
        process.exit(1);
    }

    const orangeZones = [];
    data.features.forEach(feature => {
        const properties = feature.properties || {};
        if (properties.CODE === TARGET_CODE) {
            const oppervlakteStr = properties.OPPERVLAKTE;
            if (oppervlakteStr !== null && oppervlakteStr !== undefined) {
                const area = parseFloat(oppervlakteStr);
                if (!isNaN(area)) { // Check if conversion was successful
                    const coord = getRepresentativeCoordinate(feature.geometry);
                    if (coord) { // Only add if we have a valid coordinate
                        orangeZones.push({
                            id: feature.id || "N/A",
                            area: area,
                            coordinate: coord // [longitude, latitude]
                        });
                    }
                } else {
                     // Optional: Warn about non-numeric OPPERVLAKTE
                     // console.warn(`Warning: Could not convert OPPERVLAKTE '${oppervlakteStr}' to number for feature ${feature.id}`);
                }
            }
        }
    });

    if (orangeZones.length === 0) {
        console.log(`No zones found with CODE '${TARGET_CODE}' and valid, numeric OPPERVLAKTE.`);
        return;
    }

    // Sort by area, descending
    orangeZones.sort((a, b) => b.area - a.area);

    console.log(`--- Top ${Math.min(NUMBER_TO_REPORT, orangeZones.length)} Largest '${TARGET_CODE}' Zones ---`);
    orangeZones.slice(0, NUMBER_TO_REPORT).forEach((zone, i) => {
        console.log(`${i + 1}. ID: ${zone.id}`);
        console.log(`   Area: ${zone.area.toFixed(2)} square units`); // Format area
        // Output coordinate as "latitude, longitude" for easy use in Google Maps etc.
        console.log(`   Coordinate (Lat, Lng): ${zone.coordinate[1]}, ${zone.coordinate[0]}`);
        console.log("----------");
    });
}

main(); // Run the main function