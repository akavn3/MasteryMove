import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Radio, RefreshCw, Volume2, Sparkles, AlertCircle, MessageSquare, Flame } from "lucide-react";

interface LiveCoachPanelProps {
  exercise: string;
  formErrors: {
    elbowFlare: number;
    poorDepth: number;
    asymmetry: number;
    forwardLean: number;
  };
}

interface ChatMessage {
  id: string;
  sender: "user" | "coach";
  text: string;
}

export default function LiveCoachPanel({ exercise, formErrors }: LiveCoachPanelProps) {
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [coachSpeaking, setCoachSpeaking] = useState<boolean>(false);
  const [userSpeaking, setUserSpeaking] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);

  // Refs for tracking mutable Web API objects safely
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Refs for audio player queueing
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(false);
  const lastTriggerTimeRef = useRef<number>(0);

  // Sync isMuted state to ref to avoid stale closures in audio process callback
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Monitor real-time form errors and dictate to Gemini Live model
  useEffect(() => {
    if (connectionStatus !== "connected") return;

    let postureCue = "";
    
    // Check for negative error thresholds
    if (exercise === "Squats") {
      if (formErrors.poorDepth > 0.18) postureCue = "My squat depth is too shallow right now. Give a voice tip to drop hips lower.";
      else if (formErrors.forwardLean > 0.18) postureCue = "My torso is leaning too far forward. Voice prompt me to lift my chest and keep core tight.";
    }
    else if (exercise === "Pushups") {
      if (formErrors.elbowFlare > 0.18) postureCue = "My elbows are flaring out of line. Whisper to tuck elbows 45 degrees closer to ribs.";
      else if (formErrors.forwardLean > 0.18) postureCue = "My hips are sagging down. Prompt me to align hips with shoulders.";
    }
    else if (exercise === "Bicep Curls" && formErrors.elbowFlare > 0.18) {
      postureCue = "My elbows are pulling too far backwards/out of pocket. Prompt me to glue elbows to hip sides.";
    }
    else if (exercise === "Overhead Press" && formErrors.elbowFlare > 0.18) {
      postureCue = "My elbows are flaring laterally. Ask me to stack elbows directly under palms.";
    }
    else if (formErrors.asymmetry > 0.18) {
      postureCue = "My unilateral load balance is asymmetric. Tell me to pull up evenly on both sides.";
    }

    // If no negative errors, check if the form is absolutely perfect to trigger positive encouragement!
    if (!postureCue) {
      const isPerfect = (
        (exercise !== "Squats" || (formErrors.poorDepth < 0.05 && formErrors.forwardLean < 0.05)) &&
        (exercise !== "Pushups" || (formErrors.elbowFlare < 0.05 && formErrors.forwardLean < 0.05)) &&
        (exercise !== "Bicep Curls" || formErrors.elbowFlare < 0.05) &&
        (exercise !== "Overhead Press" || formErrors.elbowFlare < 0.05) &&
        formErrors.asymmetry < 0.05
      );

      if (isPerfect) {
        postureCue = `My alignment, balance, and posture for ${exercise} are flawless. Proactively praise me with high enthusiasm! Tell me it is perfect and to lock in this kinetic cadence.`;
      }
    }

    const now = Date.now();
    // Throttle triggers to every 8 seconds so Coach speaks at a comfortable rate without overlapping excessively
    if (postureCue && now - lastTriggerTimeRef.current > 8000) {
      lastTriggerTimeRef.current = now;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Send cue to socket so Gemini Live API responds immediately over voice
        wsRef.current.send(JSON.stringify({ text: `[POSTURE ALERT: ${postureCue}]` }));
      }
    }
  }, [formErrors, exercise, connectionStatus]);

  // Handle active exercise change: close current connection if any so we can connect with new context
  useEffect(() => {
    if (connectionStatus === "connected") {
      addSystemLog("🎯 Exercise context shifted. Reconnecting Live Voice Coach...");
      disconnectSession();
      // Auto-reconnect after 800ms to fetch new custom system instructions for the active drill
      const t = setTimeout(() => {
        connectSession();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [exercise]);

  // Clean up socket and mic stream on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  const addSystemLog = (text: string, sender: "user" | "coach" = "coach") => {
    setTranscripts(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(), sender, text }
    ].slice(-16));
  };

  const connectSession = async () => {
    try {
      setConnectionStatus("connecting");
      setErrorMessage("");
      setTranscripts([]);

      // 1. Ask for media device authorization first
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Initialize low-latency AudioContext
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // input rate
      });
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = 0;

      // Create a websocket mapping
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live?exercise=${encodeURIComponent(exercise)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        addSystemLog("👑 Coach Apex connected. Let's optimize your mechanics!");

        // 3. Connect microphone capture pipeline to WebSocket
        const micSource = audioCtx.createMediaStreamSource(stream);
        micSourceNodeRef.current = micSource;

        // ScriptProcessor captures floats at 16000Hz downsampled rates
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;

          const channelData = e.inputBuffer.getChannelData(0);
          
          // Check if user is speaking based on average amplitude
          let sum = 0;
          for (let i = 0; i < channelData.length; i++) {
            sum += Math.abs(channelData[i]);
          }
          const avg = sum / channelData.length;
          setUserSpeaking(avg > 0.015);

          // Convert Float32 [-1.0, 1.0] to signed Int16 raw PCM bytes
          const pcmBuffer = new ArrayBuffer(channelData.length * 2);
          const view = new DataView(pcmBuffer);
          for (let i = 0; i < channelData.length; i++) {
            let s = Math.max(-1, Math.min(1, channelData[i]));
            // Scale and clamp to full signed int16 limits
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          }

          // Base64 encode the binary buffer chunk
          const bytes = new Uint8Array(pcmBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Audio = btoa(binary);

          ws.send(JSON.stringify({ audio: base64Audio }));
        };

        micSource.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.error) {
            setConnectionStatus("error");
            setErrorMessage(payload.error);
            disconnectSession();
            return;
          }

          // Case A: Model outputs audio chunks to play back
          if (payload.audio) {
            playReturnedPCM(payload.audio);
          }

          // Case B: Model transcription
          if (payload.text) {
            setCoachSpeaking(true);
            setTranscripts(prev => {
              // Append text to the last Coach bubble if it was very recent
              if (prev.length > 0 && prev[prev.length - 1].sender === "coach" && !prev[prev.length - 1].text.startsWith("💎") && !prev[prev.length - 1].text.startsWith("👑") && !prev[prev.length - 1].text.startsWith("🎯")) {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  text: updated[updated.length - 1].text + payload.text
                };
                return updated;
              }
              return [...prev, { id: Math.random().toString(), sender: "coach", text: payload.text }];
            });
          }

          // Case C: User transcription
          if (payload.userText) {
            setTranscripts(prev => {
              // Append to last user bubble
              if (prev.length > 0 && prev[prev.length - 1].sender === "user") {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  text: updated[updated.length - 1].text + " " + payload.userText
                };
                return updated;
              }
              return [...prev, { id: Math.random().toString(), sender: "user", text: payload.userText }];
            });
          }

          // Case D: Interrupted signal from the server
          if (payload.interrupted) {
            interruptCoachScheduledAudio();
          }

        } catch (e) {
          console.error("Live coach web packet parsing failure:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("Live coach connection error:", e);
        setConnectionStatus("error");
        setErrorMessage("Connection reset on voice proxy socket.");
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
      };

    } catch (err: any) {
      console.error("Failed to bootstrap live sensory audio system:", err);
      setConnectionStatus("error");
      setErrorMessage(err.message || "Microphone initialization refused.");
    }
  };

  const disconnectSession = () => {
    // Stop mic stream track processes
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Clean up nodes
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (micSourceNodeRef.current) {
      micSourceNodeRef.current.disconnect();
      micSourceNodeRef.current = null;
    }

    // Stop active audio queues and disconnect ctx
    interruptCoachScheduledAudio();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => {});
      audioContextRef.current = null;
    }

    // Close socket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus("disconnected");
    setCoachSpeaking(false);
    setUserSpeaking(false);
  };

  const interruptCoachScheduledAudio = () => {
    activeSourcesRef.current.forEach(src => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setCoachSpeaking(false);
  };

  // Playback Mono, 24000Hz PCM chunks
  const playReturnedPCM = (base64PCM: string) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    // Convert Base64 back to raw Int16 floats
    const binary = atob(base64PCM);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
       bytes[i] = binary.charCodeAt(i);
    }
    
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
       float32Array[i] = int16Array[i] / 32768.0;
    }

    // Create 24kHz buffer matching Gemini's audio output sample rate
    const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
    buffer.copyToChannel(float32Array, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    // Audio Sync Scheduler keeping gaps tightly controlled
    const currentTime = audioCtx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.04; // 40ms safety latency offset
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    // Track state active sources to allow rapid barge-in interrupt Stop triggers
    setCoachSpeaking(true);
    activeSourcesRef.current.push(source);

    source.onended = () => {
      const idx = activeSourcesRef.current.indexOf(source);
      if (idx > -1) {
        activeSourcesRef.current.splice(idx, 1);
      }
      if (activeSourcesRef.current.length === 0) {
        setCoachSpeaking(false);
      }
    };
  };

  return (
    <div id="live_voice_coach_panel" className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-stretch overflow-hidden shadow-xl mt-5">
      {/* Header with active states */}
      <div className="bg-slate-950 border-b border-slate-850 px-4.5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className={`w-4 h-4 ${connectionStatus === "connected" ? "text-emerald-400" : "text-slate-500"}`} />
            {connectionStatus === "connected" && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
              <span>Coach Apex Live</span>
              <span className="text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/15">Gemini 3.1</span>
            </h4>
          </div>
        </div>

        {/* Mute controller */}
        {connectionStatus === "connected" && (
          <button
            onClick={() => setIsMuted(prev => !prev)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isMuted 
                ? "bg-red-500/10 border-red-500/20 text-red-400" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Body with transcripts & interactive waves */}
      <div className="p-4 flex flex-col gap-4">
        {connectionStatus === "disconnected" && (
          <div className="text-center py-6 px-4 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <h5 className="text-xs font-bold text-slate-300">Unlock Voice Guidance</h5>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-xs">
              Establish a low-latency, real-time speech conversation with Coach Apex. Ask questions, receive form adjustments, or coordinate workout breathing on the fly.
            </p>
            <button
              onClick={connectSession}
              className="mt-4 w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-md hover:shadow-sky-500/10"
            >
              🎙️ Establish Voice Link
            </button>
          </div>
        )}

        {connectionStatus === "connecting" && (
          <div className="text-center py-8 flex flex-col items-center justify-center">
            <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mb-3" />
            <h5 className="text-xs font-bold text-slate-300">Synchronizing Spatial Audio</h5>
            <p className="text-[10px] text-slate-500 mt-1">Acquiring media buffers & spinning up Gemini session...</p>
          </div>
        )}

        {connectionStatus === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="text-xs font-bold text-red-400">Connection Interrupted</h5>
              <p className="text-[10px] text-red-300/80 mt-0.5 leading-relaxed">{errorMessage}</p>
              <button
                onClick={connectSession}
                className="mt-2 text-[10px] font-black text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                Retry voice connection
              </button>
            </div>
          </div>
        )}

        {connectionStatus === "connected" && (
          <div className="flex flex-col gap-3">
            {/* Visual audio wave representation */}
            <div className="bg-slate-950/80 rounded-xl border border-slate-850 p-3 flex flex-col items-center justify-center min-h-[70px] relative overflow-hidden">
              
              {/* Pulse rings */}
              <AnimatePresence>
                {coachSpeaking && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="absolute inset-0 bg-sky-500/10 rounded-full"
                  />
                )}
                {userSpeaking && !isMuted && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.05, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    className="absolute inset-0 bg-emerald-500/10 rounded-full"
                  />
                )}
              </AnimatePresence>

              {/* Pulsating Orb */}
              <div className="z-10 flex flex-col items-center gap-1.5">
                <span className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 ${
                  coachSpeaking 
                    ? "bg-sky-500 text-slate-950 border-sky-400 scale-110 shadow-lg shadow-sky-500/20" 
                    : userSpeaking && !isMuted
                      ? "bg-emerald-500 text-slate-950 border-emerald-450 scale-110 shadow-lg shadow-emerald-500/20 animate-pulse"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                }`}>
                  {coachSpeaking ? (
                    <Volume2 className="w-4 h-4 animate-bounce" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </span>
                <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">
                  {coachSpeaking 
                    ? "Coach Speaking..." 
                    : isMuted 
                      ? "Microphone Muted" 
                      : userSpeaking
                        ? "User Speaking..."
                        : "Listening for your voice..."}
                </span>
              </div>

              {/* Subtle digital equalizer waves */}
              <div className="absolute bottom-2 left-4 right-4 flex justify-between items-end h-3 opacity-30">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span 
                    key={i} 
                    className={`w-[2px] bg-sky-400 rounded-full transition-all duration-300 ${
                      coachSpeaking 
                        ? i % 2 === 0 ? "h-2 animate-[pulse_0.4s_infinite_alternate]" : "h-3 animate-[pulse_0.3s_infinite_alternate]"
                        : userSpeaking && !isMuted
                          ? "bg-emerald-400 h-1.5"
                          : "h-[2px]"
                    }`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Transcript scrollable pane */}
            <div id="transcript_viewport" className="bg-slate-950 rounded-xl p-3.5 border border-slate-850 h-32 overflow-y-auto flex flex-col gap-2 relative">
              <span className="absolute top-1.5 right-2 text-[8px] font-bold tracking-widest text-slate-600 uppercase flex items-center gap-1">
                <MessageSquare className="w-2.5 h-2.5" />
                Live Transcript
              </span>

              {transcripts.length === 0 ? (
                <div className="text-slate-600 text-[10px] m-auto italic font-medium">
                  Speak clearly to trigger voice corrections...
                </div>
              ) : (
                transcripts.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "self-end items-end" : "self-start items-start"}`}
                  >
                    <span className="text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-0.5">
                      {msg.sender === "user" ? "You" : "Coach Apex"}
                    </span>
                    <span className={`text-[10px] font-medium leading-relaxed px-2.5 py-1.5 rounded-lg border ${
                      msg.sender === "user"
                        ? "bg-slate-900 border-slate-800 text-slate-300 rounded-tr-none"
                        : msg.text.startsWith("👑") || msg.text.startsWith("🎯")
                          ? "bg-sky-500/10 border-sky-500/15 text-sky-400 rounded-tl-none"
                          : "bg-slate-850 border-slate-800 text-slate-300 rounded-tl-none"
                    }`}>
                      {msg.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Disconnect trigger */}
            <button
              onClick={disconnectSession}
              className="w-full bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-850 hover:border-slate-800 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              🔴 Terminate Voice Link
            </button>
          </div>
        )}
      </div>

      {/* Guide details */}
      <div className="bg-slate-950/40 p-3 border-t border-slate-850 text-[10px] text-slate-500 leading-relaxed flex gap-2 items-start">
        <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-400">Perfect Kinematic Conversation:</span> Voice Coach Apex knows the context of your active <strong className="text-slate-400">"{exercise}"</strong> drill. Try saying <span className="italic text-slate-400 font-medium">"Apex, how is my torso posture?"</span> or <span className="italic text-slate-400 font-medium">"Apex, what are my targets?"</span>
        </div>
      </div>
    </div>
  );
}
