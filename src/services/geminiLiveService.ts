import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export interface LiveSessionCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: LiveServerMessage) => void;
  onError?: (error: any) => void;
  onTranscription?: (text: string, isModel: boolean) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private audioQueue: Int16Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mixedStreamDestination: MediaStreamAudioDestinationNode | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async connect(systemInstruction: string, callbacks: LiveSessionCallbacks, options?: { disableVAD?: boolean; voiceName?: string }) {
    this.recordedChunks = [];
    try {
      this.session = await this.ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: options?.voiceName || "Zephyr" } },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          ...(options?.disableVAD ? { automatic_activity_detection: { disabled: true } } : {}),
        },
        callbacks: {
          onopen: () => {
            console.log("Live session opened");
            this.startAudioCapture();
            callbacks.onOpen?.();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              this.handleAudioOutput(base64Audio);
            }

            if (message.serverContent?.interrupted) {
              this.stopPlayback();
            }

            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              callbacks.onTranscription?.(message.serverContent.modelTurn.parts[0].text, true);
            }

            callbacks.onMessage?.(message);
          },
          onclose: () => {
            console.log("Live session closed");
            this.stopAudioCapture();
            callbacks.onClose?.();
          },
          onerror: (error) => {
            console.error("Live session error:", error);
            callbacks.onError?.(error);
          },
        },
      });
    } catch (error) {
      console.error("Failed to connect to Gemini Live:", error);
      throw error;
    }
  }

  private async startAudioCapture() {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.stream);

      // Setup mixed stream for recording
      this.mixedStreamDestination = this.audioContext.createMediaStreamDestination();
      source.connect(this.mixedStreamDestination);

      // Start recording
      this.mediaRecorder = new MediaRecorder(this.mixedStreamDestination.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start();

      // Simple script processor for audio capture
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (!this.session) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = this.floatTo16BitPCM(inputData);
        const base64Data = this.arrayBufferToBase64(pcmData.buffer);
        
        this.session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };
    } catch (error) {
      console.error("Error capturing audio:", error);
    }
  }

  private stopAudioCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.audioContext = null;
    this.stream = null;
    this.mixedStreamDestination = null;
  }

  private handleAudioOutput(base64Data: string) {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }
    
    const pcmData = this.base64ToArrayBuffer(base64Data);
    const floatData = this.pcm16ToFloat32(new Int16Array(pcmData));
    
    const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    // Also connect to mixed stream for recording
    if (this.mixedStreamDestination) {
      source.connect(this.mixedStreamDestination);
    }
    
    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  async getRecordedAudio(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (this.recordedChunks.length === 0) {
        resolve(null);
        return;
      }
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      resolve(blob);
    });
  }

  private stopPlayback() {
    this.audioQueue = [];
    this.nextStartTime = 0;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  private pcm16ToFloat32(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 32768.0;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  disconnect() {
    this.session?.close();
    this.stopAudioCapture();
  }
}
