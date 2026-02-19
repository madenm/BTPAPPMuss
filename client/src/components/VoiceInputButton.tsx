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
  const interimTranscriptRef = useRef('');

  const createRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript || '';

          if (result.isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          interimTranscriptRef.current = '';
          onTranscript(finalTranscript.trim());
        } else if (interimTranscript) {
          interimTranscriptRef.current = interimTranscript;
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          setError('Permission micro refusée');
        } else if (event.error === 'no-speech') {
          setError('Aucune parole détectée');
        } else if (event.error === 'network') {
          // Erreur réseau peut être due à HTTPS requis ou service indisponible
          const isHttp = window.location.protocol === 'http:';
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isHttp && !isLocalhost) {
            setError('HTTPS requis pour la reconnaissance vocale');
          } else {
            setError('Erreur réseau - Vérifiez votre connexion internet');
          }
        } else if (event.error === 'service-not-allowed') {
          setError('Service de reconnaissance vocale non autorisé');
        } else {
          setError(`Erreur: ${event.error}`);
        }

        setTimeout(() => setError(null), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (interimTranscriptRef.current) {
          onTranscript(interimTranscriptRef.current);
          interimTranscriptRef.current = '';
        }
      };

      return recognition;
    } catch (err) {
      console.error('Failed to create speech recognition:', err);
      return null;
    }
  }, [onTranscript, isListening]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors when stopping
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleListening = () => {
    if (disabled || !isSupported) return;

    try {
      if (isListening) {
        // Arrêter l'écoute
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            recognitionRef.current.abort();
          } catch (e) {
            // Ignore errors
          }
          recognitionRef.current = null;
        }
        setIsListening(false);
        if (interimTranscriptRef.current) {
          onTranscript(interimTranscriptRef.current);
          interimTranscriptRef.current = '';
        }
      } else {
        // Démarrer l'écoute avec une nouvelle instance
        setError(null);
        
        // Nettoyer l'ancienne instance si elle existe
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            recognitionRef.current.abort();
          } catch (e) {
            // Ignore errors
          }
          recognitionRef.current = null;
        }
        
        // Créer une nouvelle instance propre
        const recognition = createRecognition();
        if (!recognition) {
          setError('Impossible de créer la reconnaissance vocale');
          setTimeout(() => setError(null), 3000);
          return;
        }
        
        recognitionRef.current = recognition;
        
        // Démarrer après un court délai pour s'assurer que tout est prêt
        setTimeout(() => {
          if (!recognitionRef.current) return;
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (startErr) {
            console.error('Error starting recognition:', startErr);
            setIsListening(false);
            recognitionRef.current = null;
            setError('Erreur lors du démarrage');
            setTimeout(() => setError(null), 3000);
          }
        }, 50);
      }
    } catch (err) {
      console.error('Error toggling speech recognition:', err);
      setError('Erreur lors du démarrage');
      setIsListening(false);
      if (recognitionRef.current) {
        recognitionRef.current = null;
      }
      setTimeout(() => setError(null), 3000);
    }
  };

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
