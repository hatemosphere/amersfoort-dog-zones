# Amersfoort Dog Zones App

An Expo React Native application displaying designated dog off-leash zones in Amersfoort, Netherlands.

![App Screenshot Placeholder](https://via.placeholder.com/400x300.png?text=App+Screenshot) 
*(Replace with an actual screenshot)*

## Features

*   Displays dog off-leash zones (Green and Orange areas/points) on an interactive map.
*   Shows the user's current location on the map.
*   Calculates and displays the nearest off-leash zones to the user.
*   Allows users to select a zone (from the map or the list) to view details.
*   Provides navigation functionality to the selected zone via Google Maps.
*   Includes a legend explaining the map symbols.
*   Works on iOS, Android, and Web.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   Node.js (LTS version recommended)
*   npm or yarn
*   Expo CLI: `npm install -g expo-cli` (or `yarn global add expo-cli`)
*   Git

### Installing

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd amersfoort-dog-zones 
    ```
2.  **Install dependencies:**
    ```bash
    npm install 
    # or
    yarn install
    ```
3.  **Start the development server:**
    ```bash
    npx expo start
    ```
    This will open the Expo Developer Tools in your browser. You can then:
    *   Scan the QR code with the Expo Go app (Android/iOS)
    *   Press `a` to open in an Android emulator
    *   Press `i` to open in an iOS simulator
    *   Press `w` to open in your web browser

## Configuration

This application requires a Google Maps API key to display the map tiles and potentially use other Google Maps services.

### Local Development

1.  **Obtain an API Key:** Get a Google Maps API key from the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/overview). Ensure the "Maps JavaScript API" (for web) and "Maps SDK for Android" / "Maps SDK for iOS" (for native) are enabled for your key.
2.  **Create `.env` file:** Create a file named `.env` in the root directory of the project.
3.  **Add the key:** Add the following line to your `.env` file, replacing `YOUR_GOOGLE_MAPS_API_KEY` with your actual key:
    ```
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
    ```
    The `.env` file is included in `.gitignore` and should **not** be committed to version control.
4.  **Restart:** Restart your Expo development server (`npx expo start --clear`) after creating or modifying the `.env` file.

### Deployment (e.g., Vercel)

When deploying the application (especially the web version), you need to set the `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` as an environment variable within your deployment platform's settings.

*   **Vercel:** Go to your Project Settings > Environment Variables and add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` with your key as the value.

## Data Source

The application utilizes data for dog zones in Amersfoort obtained from the Dutch National Georegister (CKAN Dataplatform).

**Dataset Details:**

*   **Name:** `amersfoort-hondenkaart`
*   **Description:** Hondenkaart Amersfoort (Dog Map Amersfoort)
*   **Format:** GeoJSON
*   **Source URL:** [https://ckan.dataplatform.nl/dataset/85e28410-c1b0-41c2-bba4-15767093c477/resource/e467231b-e0c8-4c59-8ad2-c8681004f191/download/amersfoort-hondenkaart.json](https://ckan.dataplatform.nl/dataset/85e28410-c1b0-41c2-bba4-15767093c477/resource/e467231b-e0c8-4c59-8ad2-c8681004f191/download/amersfoort-hondenkaart.json)
*   **Dataset Page:** [https://ckan.dataplatform.nl/dataset/amersfoort-hondenkaart](https://ckan.dataplatform.nl/dataset/amersfoort-hondenkaart)
*   **Last Modified (Data):** 2023-05-14T21:01:06.750848
*   **Resource ID:** `e467231b-e0c8-4c59-8ad2-c8681004f191`
*   **Package ID:** `85e28410-c1b0-41c2-bba4-15767093c477`

The GeoJSON data is included locally in the project under `assets/data/amersfoort-hondenkaart.json`.

## Technologies Used

*   React Native
*   Expo
*   TypeScript
*   React Native Maps (or equivalent for web)
*   Expo Location

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

*(Specify your license here, e.g., MIT License)*

---

*This README was generated with assistance from an AI Pair Programmer.*
