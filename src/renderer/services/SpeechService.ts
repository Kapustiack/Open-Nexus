import axios from 'axios';

export class SpeechService {
  private static instance: SpeechService;
  private isEnabled: boolean = false;
  private engine: 'piper' | 'system' = 'system';
  private language: string = 'en_US';
  private voice: string = 'en_US-ryan-medium';
  private speed: number = 1.0;
  private volume: number = 1.0;

  private isSpeaking: boolean = false;
  private activeMessageId: number | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  private constructor() { }

  public static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  public updateSettings(enabled: boolean, engine: 'piper' | 'system', lang: string, vce: string, spd: number, vol: number) {
    this.isEnabled = enabled;
    this.engine = engine;
    this.language = lang;
    this.voice = vce;
    this.speed = spd;
    this.volume = vol;
  }

  public stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.activeMessageId = null;
  }

  public async speak(text: string, messageId: number, force: boolean = false, voiceOverride?: string, langOverride?: string) {
    if (!this.isEnabled && !force) return;

    this.stop();

    const filteredText = text
      .replace(/\[\[CODE_BLOCK\]\]([\s\S]*?)\[\[CODE_END\]\]/g, ' ')
      .replace(/\[\[CODE_BLOCK\]\]([\s\S]*?)\[\[\/CODE_BLOCK\]\]/g, ' ')
      .replace(/\[\[CODE_BLOCK\]\]([\s\S]*?)\[\[END_CODE_BLOCK\]\]/g, ' ')
      .replace(/\[\[CODE_BLOCK\]\][\s\S]*?\[\[CODE_END\]\]/g, '')
      .replace(/\[\[\/?CODE_BLOCK\]\]/g, ' ')
      .replace(/\[\[END_CODE_BLOCK\]\]/g, ' ')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`.*?`/g, '')
      .replace(/<run>[\s\S]*?<\/run>/g, '')
      .replace(/<write_file[\s\S]*?<\/write_file>/g, '')
      .replace(/<diff[\s\S]*?<\/diff>/g, '')
      .replace(/<patch[\s\S]*?<\/patch>/g, '')
      .replace(/<read_file[\s\S]*?\/>/g, '')
      .replace(/<create_directory[\s\S]*?\/>/g, '')
      .replace(/<delete_path[\s\S]*?\/>/g, '')
      .replace(/<list_files\s*\/>/g, '')
      .replace(/\[COMMAND:.*?\]/g, '')
      .replace(/\[SYSTEM_STATUS:.*?\]/g, '')
      .replace(/\[VERIFICATION:.*?\]/g, '')
      .replace(/\[SYSTEM:.*?\]/g, '')
      .replace(/\[FILE CONTENT:[\s\S]*?(?=\n\n|$)/g, ' ')
      .replace(/\[DIRECTORY LISTING\][\s\S]*?(?=\n\n|$)/g, ' ')
      .replace(/<<<<<<<[\s\S]*?>>>>>>> REPLACE/g, ' ')
      .replace(/^(DIR:|FILE:|PS [^\n]*>|[A-Z]:\\[^\n]*|\s*at\s.+)$/gm, ' ')
      .replace(/^[\W\d_=\-+*/\\|<>[\]{}();:'",.]+$/gm, ' ')
      .replace(/DIR:.*?|FILE:.*?/g, '')
      .replace(/[{}()[\]<>|]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!filteredText) return;

    const textToSpeak = ". . " + filteredText;

    this.isSpeaking = true;
    this.activeMessageId = messageId;

    if (this.engine === 'piper') {
      try {
        const audioBuffer = await window.electron.generateSpeech({
          text: filteredText,
          voice: voiceOverride || this.voice,
          language: langOverride || this.language,
          speed: this.speed
        });

        if (audioBuffer) {
          const data: any = audioBuffer instanceof Uint8Array ? audioBuffer : new Uint8Array(Object.values(audioBuffer));
          const blob = new Blob([data], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          this.currentAudio = new Audio(url);
          this.currentAudio.volume = this.volume;

          this.currentAudio.onended = () => {
            this.isSpeaking = false;
            this.activeMessageId = null;
          };

          setTimeout(async () => {
            if (this.currentAudio) {
              try {
                await this.currentAudio.play();
              } catch (playErr) {
                console.error("Playback failed", playErr);
              }
            }
          }, 150);
        }
      } catch (e) {
        console.error('Piper failed, falling back to system TTS', e);
        this.speakSystem(textToSpeak);
      }
    } else {
      this.speakSystem(textToSpeak);
    }
  }

  private speakSystem(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.language;
    utterance.rate = this.speed;
    utterance.volume = this.volume;

    utterance.onend = () => {
      this.isSpeaking = false;
      this.activeMessageId = null;
    };

    utterance.onerror = (e) => {
      console.error('System TTS Error:', e);
      this.isSpeaking = false;
      this.activeMessageId = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  public getSpeakingState() {
    return { isSpeaking: this.isSpeaking, messageId: this.activeMessageId };
  }
}
