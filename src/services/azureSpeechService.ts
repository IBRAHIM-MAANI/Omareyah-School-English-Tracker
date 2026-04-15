import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureAssessmentResult {
  overall: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody: number;
  cefr: string;
  feedback: string;
  words?: any[];
  audioUrl?: string;
  audioData?: ArrayBuffer;
}

export const runAzureAssessment = (audioBlob: Blob, referenceText: string): Promise<AzureAssessmentResult> => {
  return new Promise((resolve, reject) => {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION || "uaenorth";

    if (!speechKey) {
      reject(new Error("Azure Speech key is not configured."));
      return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = "en-US";

    const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
      referenceText,
      SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
      SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
      true
    );

    const audioConfig = SpeechSDK.AudioConfig.fromWavFileInput(audioBlob as File);
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    
    pronunciationConfig.applyTo(recognizer);

    recognizer.recognizeOnceAsync(
      result => {
        if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const assessmentResult = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
          
          const finalReport: AzureAssessmentResult = {
            overall: assessmentResult.pronunciationScore,
            accuracy: assessmentResult.accuracyScore,
            fluency: assessmentResult.fluencyScore,
            completeness: assessmentResult.completenessScore,
            prosody: assessmentResult.prosodyScore,
            cefr: mapToCEFR(assessmentResult.accuracyScore),
            feedback: "Linguistic audit complete.",
            words: assessmentResult.detailResult.Words,
            audioData: (result as any).audioData
          };

          recognizer.close();
          resolve(finalReport);
        } else {
          recognizer.close();
          reject(new Error(`Speech recognition failed: ${result.errorDetails || 'Unknown error'}`));
        }
      },
      err => {
        recognizer.close();
        reject(err);
      }
    );
  });
};

const mapToCEFR = (score: number): string => {
  if (score >= 90) return "C1/C2";
  if (score >= 75) return "B2";
  if (score >= 60) return "B1";
  return "A2/A1";
};

export const runReadingTest = (referenceText: string, studentName: string): Promise<AzureAssessmentResult> => {
  return new Promise((resolve, reject) => {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION || "uaenorth";

    if (!speechKey) {
      reject(new Error("Azure Speech key is not configured."));
      return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = "en-US";
    speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000");

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
      referenceText,
      SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
      SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
      true
    );
    pronunciationConfig.applyTo(recognizer);

    recognizer.recognizeOnceAsync(
      result => {
        if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const assessmentResult = SpeechSDK.PronunciationAssessmentResult.fromResult(result);
          
          const finalReport: AzureAssessmentResult = {
            overall: assessmentResult.pronunciationScore,
            accuracy: assessmentResult.accuracyScore,
            fluency: assessmentResult.fluencyScore,
            completeness: assessmentResult.completenessScore,
            prosody: assessmentResult.prosodyScore,
            cefr: mapToCEFR(assessmentResult.accuracyScore),
            feedback: "Reading assessment complete.",
            words: assessmentResult.detailResult.Words,
            audioData: (result as any).audioData
          };

          recognizer.close();
          resolve(finalReport);
        } else {
          recognizer.close();
          reject(new Error(`Assessment failed: ${result.errorDetails || 'No speech detected'}`));
        }
      },
      err => {
        recognizer.close();
        reject(err);
      }
    );
  });
};

export const runSpeakingTest = (): Promise<{ text: string; audioData: ArrayBuffer }> => {
  return new Promise((resolve, reject) => {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION || "uaenorth";

    if (!speechKey) {
      reject(new Error("Azure Speech key is not configured."));
      return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechRecognitionLanguage = "en-US";
    speechConfig.setProperty(SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000");

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizeOnceAsync(
      result => {
        if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          resolve({
            text: result.text,
            audioData: (result as any).audioData
          });
        } else {
          reject(new Error("No speech detected."));
        }
        recognizer.close();
      },
      err => {
        recognizer.close();
        reject(err);
      }
    );
  });
};
