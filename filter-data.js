// Script to filter the Amersfoort dog zones data
// Keeps only GROEN and ORANJE zones to reduce file size and improve app startup time

const fs = require('fs');
const path = require('path');

console.log('Starting data filtering process...');

// Input and output file paths
const inputFilePath = path.join(__dirname, 'assets', 'data', 'amersfoort-hondenkaart.json');
const outputFilePath = path.join(__dirname, 'assets', 'data', 'amersfoort-hondenkaart-filtered.json');
const backupFilePath = path.join(__dirname, 'assets', 'data', 'amersfoort-hondenkaart-original.json');

// Load the original data
let originalData;
try {
  console.log(`Attempting to load from: ${inputFilePath}`);
  // Check if the file exists
  if (!fs.existsSync(inputFilePath) && fs.existsSync(backupFilePath)) {
    console.log('Original file not found, using backup...');
    const fileContent = fs.readFileSync(backupFilePath, 'utf8');
    originalData = JSON.parse(fileContent);
    
    // Also restore the original file
    fs.copyFileSync(backupFilePath, inputFilePath);
    console.log('Restored original file from backup.');
  } else if (fs.existsSync(inputFilePath)) {
    const fileContent = fs.readFileSync(inputFilePath, 'utf8');
    originalData = JSON.parse(fileContent);
    
    // Create a backup if it doesn't exist
    if (!fs.existsSync(backupFilePath)) {
      fs.copyFileSync(inputFilePath, backupFilePath);
      console.log(`Backup of original data created at: ${backupFilePath}`);
    }
  } else {
    console.error('Neither original nor backup file found!');
    process.exit(1);
  }
  
  console.log(`Original data loaded: ${originalData.features.length} features`);
} catch (error) {
  console.error('Error loading the original data:', error);
  process.exit(1);
}

// Filter to keep only GROEN and ORANJE features
const filteredFeatures = originalData.features.filter(feature => {
  const code = feature.properties?.CODE;
  return code === 'GROEN' || code === 'ORANJE';
});

// Create a new GeoJSON object with only the filtered features
const filteredData = {
  ...originalData,
  features: filteredFeatures
};

// Calculate statistics
const originalSize = Buffer.byteLength(JSON.stringify(originalData));
const filteredSize = Buffer.byteLength(JSON.stringify(filteredData));
const reductionPercent = ((originalSize - filteredSize) / originalSize * 100).toFixed(2);

console.log(`Filtered data: ${filteredFeatures.length} features (${filteredFeatures.length} of ${originalData.features.length})`);
console.log(`Size reduction: ${(originalSize / (1024 * 1024)).toFixed(2)} MB -> ${(filteredSize / (1024 * 1024)).toFixed(2)} MB (${reductionPercent}% reduction)`);

// Count features by code
const orangeCount = filteredFeatures.filter(f => f.properties?.CODE === 'ORANJE').length;
const greenCount = filteredFeatures.filter(f => f.properties?.CODE === 'GROEN').length;
console.log(`Breakdown: ${greenCount} GROEN features, ${orangeCount} ORANJE features`);

// Write the filtered data to a new file - use minified JSON (without indentation)
try {
  fs.writeFileSync(outputFilePath, JSON.stringify(filteredData));
  console.log(`Filtered data saved to: ${outputFilePath}`);
  
  // Validate the filtered file
  try {
    const filteredFileContent = fs.readFileSync(outputFilePath, 'utf8');
    const parsedFilteredData = JSON.parse(filteredFileContent);
    console.log(`Validation: Filtered file contains ${parsedFilteredData.features.length} features.`);
  } catch (validationError) {
    console.error('Error validating filtered file:', validationError);
  }
} catch (error) {
  console.error('Error writing filtered data:', error);
  process.exit(1);
}

console.log('Data filtering completed successfully.'); 