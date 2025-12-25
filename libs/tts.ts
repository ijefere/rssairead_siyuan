import { IPluginConfig } from "./settings";

export async function playText(text: string, config: IPluginConfig, apiKey?: string) {
    if (!config.tts.enable) return;

    if (config.tts.provider === "browser") {
        await playBrowserTTS(text, config.tts);
    } else if (config.tts.provider === "openai") {
        // Use the passed apiKey, or fallback to config.llm.apiKey if not explicitly provided for TTS (assuming shared key)
        const key = apiKey || config.llm.apiKey;
        if (!key) {
            console.error("OpenAI TTS requires an API Key.");
            return;
        }
        await playOpenAITTS(text, config.tts, key);
    }
}

function playBrowserTTS(text: string, config: IPluginConfig["tts"]) {
    return new Promise<void>((resolve, reject) => {
        // Cancel any previous utterance
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (config.voice) {
            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(v => v.name === config.voice || v.voiceURI === config.voice);
            if (selectedVoice) utterance.voice = selectedVoice;
        }
        utterance.rate = config.speed;
        
        utterance.onend = () => resolve();
        utterance.onerror = (e) => {
            console.error("Browser TTS Error:", e);
            reject(e);
        };

        window.speechSynthesis.speak(utterance);
    });
}

async function playOpenAITTS(text: string, config: IPluginConfig["tts"], apiKey: string) {
    try {
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "tts-1",
                input: text,
                voice: config.voice || "alloy",
                speed: config.speed
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI TTS API Error: ${response.status} - ${err}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        return new Promise<void>((resolve, reject) => {
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                resolve();
            };
            audio.onerror = (e) => {
                URL.revokeObjectURL(audioUrl);
                reject(e);
            };
            audio.play();
        });

    } catch (error) {
        console.error("OpenAI TTS Request Failed:", error);
        throw error;
    }
}
