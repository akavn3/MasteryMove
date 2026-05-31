import express from "express";
import path from "path";
import dotenv from "dotenv";
import http from "http";
import url from "url";
import { WebSocketServer, WebSocket as NodeWebSocket } from "ws";
import { GoogleGenAI, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Polyfill global WebSocket for Node environment to ensure @google/genai's live client integrates correctly
(globalThis as any).WebSocket = NodeWebSocket;

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json());

const server = http.createServer(app);

// Use noServer mode so that Vite HMR upgrades do not collide with our live API WebSocket routes
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const parsed = url.parse(request.url || "");
  if (parsed.pathname === "/api/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Initialize Gemini SDK with telemetry
const getGenAI = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ GEMINI_API_KEY environment variable is not defined. AI Coaching is disabled.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: Health probe
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API: Real-time Coaching TTS via Gemini Voice Models
app.post("/api/tts", async (req, res) => {
  const { text, voice = "Kore" } = req.body;
  
  const ai = getGenAI();
  if (!ai) {
    return res.status(200).json({ 
      success: false, 
      error: "Gemini API key is not configured. TTS is offline." 
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say confidently and encouragingly in under 8 words: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            // Options: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ success: true, audio: base64Audio });
    } else {
      res.json({ success: false, error: "Modality response was successful but did not yield inline audio data." });
    }
  } catch (error: any) {
    const errorString = String(error?.message || error);
    const isQuotaError = errorString.includes("quota") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("429");
    
    if (isQuotaError) {
      console.warn("⚠️ Gemini TTS Quota exceeded (Free-tier limit reached). Notifying client to activate client-side Speech Synthesis fallback.");
      return res.status(200).json({ success: false, fallback: true, error: "Gemini TTS quota limits reached" });
    }
    
    console.error("Gemini TTS Voice generation error:", error);
    res.status(500).json({ success: false, error: errorString || "Interference on TTS voice layer" });
  }
});

// API: Athlete Session Biometrics Summary via AI Coach
app.post("/api/feedback", async (req, res) => {
  const {
    exercise,
    repCount,
    precisionScore,
    symmetryScore,
    postureScore,
    duration,
    feedbackHistory = [],
    angleStats = {}
  } = req.body;

  const ai = getGenAI();
  if (!ai) {
    return res.status(200).json({
      success: true,
      feedback: `### AI Coach Offline\n\nTo unlock high-precision coaching feedback, please configure your **GEMINI_API_KEY** in the Secrets panel.\n\n**Current Metrics:**\n* Exercise: ${exercise}\n* Reps: ${repCount}\n* Precision Score: ${precisionScore}%\n* Symmetry Score: ${symmetryScore}%\n* Posture Alignment: ${postureScore}%\n* Duration: ${duration}s`,
    });
  }

  try {
    const systemPrompt = `You are "Coach Apex", an elite biomechanics scientist and high-performance athletic coach. You analyze workout telemetry and provide constructive, ultra-precise, encouraging, and detailed feedback to help athletes master their physical form.`;

    const userPrompt = `Analyze this athlete's training session telemetry and provide a detailed biomechanical report. Always maintain an inspiring yet highly technical coach persona.

Session Details:
- **Exercise Category**: ${exercise}
- **Completed Reps**: ${repCount}
- **Overall Precision Score**: ${precisionScore}% (Confidence matching of target angles)
- **Symmetry Balance Score**: ${symmetryScore}% (Limb coordinate differential balance)
- **Posture Stiffness & Rigidity Score**: ${postureScore}%
- **Workout Duration**: ${duration} seconds

Real-time Coach Triggers / Flags occurred:
${feedbackHistory.length > 0 ? feedbackHistory.map((v: string) => `- "${v}"`).join("\n") : "- Form was quiet throughout. No active joint deviations flag."}

Recorded Biomechanical Angle Extremes:
${JSON.stringify(angleStats, null, 2)}

Produce a clean, professional athletic assessment. You must not only praise achievements but also explicitly assess mistakes and write detailed corrections. Map your analysis clearly matching these states:
- **RED (Incorrect)**: Explicitly list incorrect angles or motions, stating which specific body parts are incorrect and what exact correctional drill is required.
- **YELLOW/ORANGE (Decent)**: Highlight decent, stable performance, offering optimization pointers.
- **GREEN (Perfect)**: Compliment perfect postures and encourage maintaining the target kinematics.

Structure your report as follows:
### 1. 🏆 Athlete Appraisal
Discuss the overall score, pacing/tempo, structure of the workout, and how they stack up.

### 2. 🔬 Biomechanical & Joint Analysis
Analyze the symmetry, hip/knee/shoulder flexion statistics, and trunk posture stability. Discuss why certain triggers occurred (e.g., if "flared elbows" occurred, explain how this reduces shoulder stability and wastes kinetic energy) classified under RED, YELLOW, or GREEN.

### 3. 🎯 High-Performance Mastery Plan
Provide 2-3 specific, actionable athletic cues and corrective exercises (such as active shoulder backing, hip-hinge focus, or specific mobility stretches) to implement in their very next workout to hit 100% precision. Do not give general advice; render precise biomechanical actions.

Format the output strictly as beautifully styled Markdown with crisp visual spacing.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    res.json({
      success: true,
      feedback: response.text,
    });
  } catch (error: any) {
    console.error("Gemini API Feedback error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred while generating coaching feedback."
    });
  }
});

// Setup WebSocket Gemini Live API Session Bridge
wss.on("connection", async (clientWs, req) => {
  const parsedUrl = url.parse(req.url || "", true);
  const exercise = (parsedUrl.query.exercise as string) || "Squats";

  console.log(`[WebSocket] Live Coach Session requested for: ${exercise}`);

  const ai = getGenAI();
  if (!ai) {
    clientWs.send(JSON.stringify({ error: "Gemini API key is not configured. Live coaching is offline." }));
    clientWs.close();
    return;
  }

  try {
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: `You are "Coach Apex", an elite biomechanics scientist and high-performance athletic coach conducting a focused, technically critical 1-on-1 training session.
The athlete is currently performing: "${exercise}".

Strict coaching guidelines:
1. Critical and Disciplined Persona: Do not sugarcoat or give generic praise when there are deviations or if visual tracking is lost. If the athlete does the wrong exercise, or has poor form, call them out firmly and give strict corrective instructions.
2. Prevent Repetition: NEVER repeat the exact same correction phrase twice in a row. If a deviation persists, vary your words, explain the physical/biomechanical reason for the fix, or use new metaphors (e.g., 'imagine a board behind your spine', 'keep triceps glued to your ribs').
3. Be Numerical and Specific: If you receive a "[POSTURE ALERT:" message containing specific percentages, distances, or angles, incorporate those exact numbers directly into your verbal comments! Do not speak in vague generalizations.
4. Structured Feedback Model:
   - RED (Incorrect Form / Mismatch / Lost Tracking): Explicitly identify incorrect body parts, state the exact numerical deviation if provided, explain the risk (e.g. knee strain, momentum swinging), and demand corrective realignment.
   - ORANGE/YELLOW (Steady/Warning): Acknowledge their balance, but recommend a physical adjustment to keep optimal muscle isolation.
   - GREEN (Perfect Form): Proactively give a brief, high-energy praise under 6 words only when specifically triggered with no form errors.
5. If you receive a text starting with "[POSTURE ALERT:", immediately speak with a punchy verbal cue (keep it under 18 words) targeting that exact joint.`,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onmessage: (message: any) => {
          const serverContent = message?.serverContent;
          if (!serverContent) return;

          // Send audio output
          if (serverContent.modelTurn) {
            const parts = serverContent.modelTurn.parts;
            const audio = parts?.find((p: any) => p.inlineData?.data)?.inlineData?.data;
            const text = parts?.find((p: any) => p.text)?.text;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (text) {
              clientWs.send(JSON.stringify({ text })); // Model speech transcription
            }
          }
          // Send input transcription
          if (serverContent.userTurn) {
            const userText = serverContent.userTurn.parts?.find((p: any) => p.text)?.text;
            if (userText) {
              clientWs.send(JSON.stringify({ userText })); // User speech transcription
            }
          }
          // Send interrupt signal
          if (serverContent.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
      }
    });

    clientWs.on("message", (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (payload.text) {
          // Forward client posture triggers as real-time text inputs
          session.sendRealtimeInput({
            text: payload.text
          });
        }
      } catch (err) {
        console.error("Error processing client live voice packet:", err);
      }
    });

    clientWs.on("close", () => {
      console.log(`[WebSocket] Live Coach Session terminated`);
      try {
        session.close();
      } catch (e) {
        // Already closed
      }
    });

  } catch (error: any) {
    console.error("Failed to connect to Gemini Live session:", error);
    clientWs.send(JSON.stringify({ error: `Connection failed: ${error.message || error}` }));
    clientWs.close();
  }
});

// Setup Vite Dev Server / Static Assets
async function boot() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[MasteryMove Express Server] Operational at http://localhost:${PORT}`);
  });
}

boot();
