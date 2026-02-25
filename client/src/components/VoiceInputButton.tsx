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
  const onTranscriptRef = useRef(onTranscript);
  const isStartingRef = useRef(false);
  const processedFinalCountRef = useRef(0);

  // Mettre à jour la ref à chaque changement de onTranscript
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    // Vérifier si l'API est supportée au montage
    // Support de tous les préfixes de navigateurs
    const SpeechRecognition = 
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;
    
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
      return;
    }

    // Guard 2: Déjà en train de démarrer
    if (isStartingRef.current) {
      return;
    }

    isStartingRef.current = true;

    const SpeechRecognition = 
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('❌ Speech Recognition API non disponible');
      isStartingRef.current = false;
      setError('Microphone non supporté - Utilisez Chrome, Edge, Opera, Safari ou Firefox');
      setIsListening(false);
      setTimeout(() => setError(null), 5000);
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

      // Configuration
      recognition.continuous = true;      // Continue sans s'arrêter
      recognition.interimResults = true;  // Affiche au fur et à mesure
      recognition.lang = 'fr-FR';

      // Handlers d'événements
      const handleStart = () => {
        isStartingRef.current = false;
        setIsListening(true);
        setError(null);
        transcriptRef.current = '';
        processedFinalCountRef.current = 0;
      };

      const handleResult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let newFinalText = '';
        let finalCount = 0;

        // Boucler à travers tous les résultats
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            finalCount = i + 1;
            // Ne traiter que les nouveaux finaux pour éviter la duplication
            if (i >= processedFinalCountRef.current) {
              newFinalText += transcript + ' ';
            }
          } else {
            // Pour les intermédiaires, toujours les inclure pour l'affichage temps réel
            interimTranscript += transcript;
          }
        }

        // Ajouter les nouveaux résultats finaux
        if (newFinalText) {
          transcriptRef.current += newFinalText;
          processedFinalCountRef.current = finalCount;
        }

        // Construire le texte à afficher: finaux accumulés + intermédiaires en temps réel
        const textToDisplay = (transcriptRef.current + interimTranscript).trim();

        // Envoyer le texte complet à chaque changement (affiche au fur et à mesure)
        if (textToDisplay) {
          onTranscriptRef.current(textToDisplay);
        }
      };

      const handleError = (event: SpeechRecognitionErrorEvent) => {
        console.error('❌ Erreur vocale:', event.error);
        isStartingRef.current = false;

        const errorMessages: Record<string, string> = {
          'network': 'Erreur réseau - Vérifiez votre connexion internet',
          'not-allowed': 'Permission refusée - Autorisez le microphone dans les paramètres du navigateur',
          'no-speech': 'Aucune parole détectée - Essayez de nouveau en parlant',
          'service-not-allowed': 'Service non autorisé par le navigateur',
          'audio-capture': 'Erreur microphone - Vérifiez que le micro fonctionne',
          'bad-grammar': 'Erreur de grammaire',
          'network-error': 'Erreur réseau',
          'aborted': 'Enregistrement annulé',
        };

        const message = errorMessages[event.error] || `Erreur: ${event.error}`;
        setError(message);
        setIsListening(false);
        setTimeout(() => setError(null), 5000);
      };

      const handleEnd = () => {
        isStartingRef.current = false;
        setIsListening(false);
        transcriptRef.current = '';
        processedFinalCountRef.current = 0;
      };

      // Attacher les handlers
      recognition.onstart = handleStart;
      recognition.onresult = handleResult;
      recognition.onerror = handleError;
      recognition.onend = handleEnd;

      recognitionRef.current = recognition;

      // Démarrer l'enregistrement
      recognition.start();

    } catch (err) {
      console.error('❌ Erreur exception:', err);
      isStartingRef.current = false;
      
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      // Vérifier si c'est une erreur de permission
      if (errorMsg.includes('Permission') || errorMsg.includes('permission')) {
        setError('Permission refusée - Autorisez le microphone');
      } else {
        setError('Erreur: ' + errorMsg);
      }
      
      setIsListening(false);
      setTimeout(() => setError(null), 5000);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // silently fail
        }
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (disabled || !isSupported) {
      return;
    }

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
            ? 'Reconnaissance vocale non supportée - Chrome, Edge, Opera, Safari ou Firefox requis'
            : isListening
            ? 'Arrêter la dictée vocale'
            : 'Démarrer la dictée vocale'
        }
        aria-label={
          !isSupported
            ? 'Reconnaissance vocale non supportée par votre navigateur'
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
        <div className="absolute top-full left-0 mt-1 px-3 py-2 bg-red-500/95 text-white text-xs rounded whitespace-normal z-50 max-w-xs shadow-lg">
          {error}
        </div>
      )}
      {isListening && (
        <div className="absolute top-full left-0 mt-1 px-3 py-2 bg-blue-500/95 text-white text-xs rounded whitespace-nowrap z-50 shadow-lg animate-pulse">
          🎤 En écoute...
        </div>
      )}
    </div>
  );
}
