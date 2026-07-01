# DrawTogether

Real-time multiplayer drawing app built with React Native (Expo), SVG, and WebSocket.

## Features

- **10 brush types**: pen, calligraphy, watercolor, pencil, charcoal, airbrush, marker, highlighter, spray, eraser
- **Shape tools**: rectangle, circle, line, arrow
- **Text tool**: tap to add text with multiple font sizes
- **Eyedropper**: tap any stroke to pick its color
- **Select & transform**: tap to select, drag to move
- **Layers**: add, reorder, toggle visibility
- **Undo/redo**: full history stack
- **Grid overlay**: toggleable grid for precise drawing
- **Color picker**: 24 presets + 60-step hue strip + custom hex input
- **Brush size**: continuous slider (1–40px)
- **Canvas size**: 5 presets + custom dimensions (200–4000px)
- **Image trace**: import image as reference layer behind strokes
- **Export**: PNG/JPEG (web download, mobile share sheet)
- **Real-time multiplayer**: room codes, in-room chat
- **Replay**: stroke-by-stroke timelapse with speed control
- **Dark mode**: toggle with system persistence
- **Gallery**: saved drawings with thumbnails, star/favorite
- **Auth**: email/password with JWT

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- Android device or emulator (for mobile testing)

### Setup

```bash
# Install dependencies
cd DrawTogether
npm install

# Start the dev server
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Running with Backend

1. Start the server:
   ```bash
   cd DrawTogetherServer
   node server.js
   ```

2. Forward ports for USB testing:
   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:8080 tcp:8080
   ```

3. Open `exp://localhost:8081` in Expo Go.

## Tech Stack

- **Frontend**: React Native, Expo SDK 56, react-native-svg, react-native-webview
- **Backend**: Node.js, Express, WebSocket (ws), JWT (jsonwebtoken), bcryptjs
- **Storage**: JSON file-based (no database required)

## Project Structure

```
DrawTogether/
├── src/
│   ├── app/           # Expo Router pages (canvas, home, login, _layout)
│   ├── lib/           # API client, auth helpers, theme context
│   └── constants/     # Theme colors, spacing, shadows
├── app.json
└── package.json

DrawTogetherServer/
├── server.js          # Express + WebSocket server
├── data/              # JSON file storage (users, drawings)
└── render.yaml        # Render deployment config
```
