# MasteryMove 🏋️⚡

MasteryMove is a high-performance, real-time biomechanics training platform powered by **Coach Apex**—an elite digital biomechanics scientist. Integrating advanced, client-side computer vision with server-side multi-modal analysis, MasteryMove analyzes individual movement patterns to deliver instant corrective feedback and structured athletic appraisals.

---

## ✨ Key Capabilities

- 🤖 **On-Device Pose Estimation**: Runs high-speed, client-side skeletal tracking (<50ms latency) using standard webcams via **MediaPipe's PoseLandmarker API**. All spatial processing is kept local to ensure complete user privacy.
- 🟥🟨🟩 **3-Tier Real-Time Biomechanics Alert System**: Form metrics are graded instantaneously:
  - **RED (Action Required)**: Critical errors such as elbow flare, slouching/sagging, or poor squat depth.
  - **YELLOW/ORANGE (Decent)**: Solid control, but offers optimization targets to lock in stability.
  - **GREEN (Optimal)**: Confirms perfect skeletal alignment and trajectory control.
- 🎙️ **Reactive TTS Coach**: Delivers punchy, conversational, and encouraging physical coaching cues during movement transitions.
- 🏆 **Comprehensive Post-Session Appraisals**: Provides deep statistical summaries, range-of-motion metrics, joint asymmetry measurements, and actionable coaching feedback.

---

## 🏃 Supported Exercises & Drills

1. **Squats**: Tracks depth (ideal knee flexion peak), forward trunk lean, and horizontal stance asymmetry.
2. **Bicep Curls**: Monitors elbow flare drift and optimal peak concentric contraction.
3. **Overhead Press**: Validates vertical scapular lock, symmetry, and stabilizer activation.
4. **Pushups**: Audits abdominal spine stiffness (preventing sagging hips) and elbow-to-rib proximity.
5. **Warrior II (Yoga)**: Evaluates deep lateral pelvic lunge depth and horizontal arm carriage levels.
6. **Tree Pose (Yoga)**: Measures stability, balance, torso extension, and vertical/hip abduction boundaries.
7. **Downward Dog (Yoga)**: Analyzes thoracic flattening, hip lift vectors, and ankle-extension flexibility.
8. **Cobra Pose (Yoga)**: Checks ground pelvic anchors and scapular retraction heights.
9. **Finger Pinch Drill (Neuromotor)**: Pinpoints unilateral motor coordination and bilateral finger range asymmetry.
10. **Facial Mobility (Rehabilitative)**: Graphs symmetric muscle activation and bilateral nerve responsiveness.

---

## 🛠️ Architecture

MasteryMove is built as a highly optimized full-stack application:

- **Frontend**: React, Vite, Tailwind CSS, Lucide icons, and Recharts visualization components.
- **Computer Vision**: `@mediapipe/pose` is configured with client-side WebGL canvas redraw loops to optimize frames and minimize CPU overhead.
- **Backend (Node/Express)**: Secure server-side routes proxying calls to Gemini. It processes final performance metrics (reps, precision averages, and angular extremes) to generate rich, personalized coaching summaries.
- **Audio Module**: Dynamic coaching alerts utilize client-side speech synthesis with customized sound-muted controls targeting specific notifications (such as depth validation alerts) to ensure an immersive, personalized workouts.

---

## 🚀 Getting Started

### Prerequisites

To get started, you must have Node.js (version 18 or higher) installed.

### Installation

1. Install the workspace dependencies:
   ```bash
   npm install
   ```

2. Generate your `.env` file from the example template:
   ```bash
   cp .env.example .env
   ```
   Add your premium Gemini AI access key under `GEMINI_API_KEY` to enable the full Coach Apex Live experience and post-workout summary generator.

### Development Server

Start the local development server:
   ```bash
   npm run dev
   ```
The app will run at [http://localhost:3000](http://localhost:3000).

### Build & Deploy

Compile a CJS web-server and bundled frontend package cleanly inside `dist/`:
   ```bash
   npm run build
   npm run start
   ```

---

## 🔒 Privacy & Safety

User webcam footage is processed entirely locally inside your browser sandbox. No video, images, or raw sensor frames are sent to external servers or APIs. Only end-of-session numeric statistics (count, average accuracy, score profiles) are routed to our secure backend endpoints to synthesize your personalized Coach Apex training summary.
