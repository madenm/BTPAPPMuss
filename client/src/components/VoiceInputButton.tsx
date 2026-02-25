import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export function VoiceInputButton({ onTranscript, disabled, className }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const lastSentRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const isStartingRef = useRef(false);

  // Mettre à jour la ref à chaque changement de onTranscript (sans créer de dépendance)
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    // Vérifier si l'API est supportée au montage
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isSupp = !!SpeechRecognition;
    setIsSupported(isSupp);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // silently fail
        }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    // Guard 1: Déjà en écoute
    if (isListening) {
      console.log('⚠️ Écoute déjà active');
      return;
    }

    // Guard 2: Déjà en train de démarrer
    if (isStartingRef.current) {
      console.log('⚠️ Démarrage déjà en cours');
      return;
    }

    isStartingRef.current = true;
    console.log('▶️  Démarrage de la reconnaissance...');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('❌ Speech Recognition API non disponible');
      setError('API non supportée');
      return;
    }

    try {
      // Arrêter l'ancienne instance si elle existe
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // silently fail
        }
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();

      // Configuration stricte
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      // Handlers d'événements - définis UNE FOIS
      recognition.onstart = () => {
        console.log('✅ Reconnaissance vocale active');
        isStartingRef.current = false;
        setIsListening(true);
        setError(null);
        transcriptRef.current = '';
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            transcriptRef.current += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Envoyer le texte COMPLET (final accumulé + temporaire)
        const fullText = (transcriptRef.current + interimTranscript).trim();
        if (fullText) {
          onTranscriptRef.current(fullText);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('❌ Erreur:', event.error);
        isStartingRef.current = false;
        setIsListening(false);

        const errorMessages: Record<string, string> = {
          'network': 'Erreur réseau - Vérifiez HTTPS ou connextion',
          'not-allowed': 'Permission refusée - Autorisez le micro',
          'no-speech': 'Aucune parole détectée',
          'service-not-allowed': 'Service non autorisé',
          'audio-capture': 'Erreur micro',
        };

        setError(errorMessages[event.error] || `Erreur: ${event.error}`);
        setTimeout(() => setError(null), 4000);
      };

      recognition.onend = () => {
        console.log('⏹️ Reconnaissance arrêtée');
        isStartingRef.current = false;
        
        // Envoyer le texte final accumulé avant de réinitialiser
        const finalText = transcriptRef.current.trim();
        if (finalText) {
          onTranscriptRef.current(finalText);
        }
        
        setIsListening(false);
        transcriptRef.current = '';
      };

      recognitionRef.current = recognition;

      // Démarrer
      try {
        recognition.start();
        console.log('🔊 start() exécuté');
      } catch (err) {
        console.error('❌ Erreur start():', err);
        isStartingRef.current = false;
        setError('Impossible de démarrer');
        setIsListening(false);
        setTimeout(() => setError(null), 3000);
      }

    } catch (err) {
      console.error('❌ Erreur création:', err);
      isStartingRef.current = false;
      setError('Erreur création reconnaissance');
      setIsListening(false);
      setTimeout(() => setError(null), 3000);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    console.log('⏹️ Arrêt demandé');
    // Mettre l'état à jour IMMÉDIATEMENT
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('✅ stop() exécuté');
      } catch (err) {
        console.error('Erreur stop():', err);
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // silently fail
        }
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (disabled || !isSupported) return;

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, disabled, isSupported, startListening, stopListening]);

  return (
    <div className={`relative ${className || ''}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggleListening}
        disabled={disabled || !isSupported}
        className={`${
          isListening
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50'
            : isSupported
            ? 'hover:bg-white/10 text-white'
            : 'opacity-50 cursor-not-allowed text-white/50'
        } transition-colors`}
        title={
          !isSupported
            ? 'Reconnaissance vocale non supportée par votre navigateur (Chrome, Edge ou Safari requis)'
            : isListening
            ? 'Arrêter la dictée vocale'
            : 'Démarrer la dictée vocale'
        }
        aria-label={
          !isSupported
            ? 'Reconnaissance vocale non supportée'
            : isListening
            ? 'Arrêter la dictée vocale'
            : 'Démarrer la dictée vocale'
        }
      >
        {isListening ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
      {error && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-500/90 text-white text-xs rounded whitespace-nowrap z-50">
          {error}
        </div>
      )}
      {isListening && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-blue-500/90 text-white text-xs rounded whitespace-nowrap z-50">
          En écoute...
        </div>
      )}
    </div>
  );
}
