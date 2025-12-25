
export interface IPluginConfig {
    llm: {
        enable: boolean;
        provider: "openai" | "custom";
        apiKey: string;
        baseUrl: string;
        model: string;
        prompt: string;
    };
    tts: {
        enable: boolean;
        provider: "browser" | "openai";
        voice: string; // For browser: voiceURI, For OpenAI: alloy, echo, etc.
        speed: number;
    };
    summary: {
        enable: boolean;
        cron: string;
        targetDocId: string;
    }
}

export const DEFAULT_CONFIG: IPluginConfig = {
    llm: {
        enable: false,
        provider: "openai",
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-3.5-turbo",
        prompt: "你是一个高效的新闻助理。请阅读以下RSS订阅源的更新条目，并生成一份简明扼要的日报摘要。要求：\n1. 按重要性排序，将最重要的新闻排在前面。\n2. 对相似主题进行合并。\n3. 使用Markdown格式，要点清晰。\n4. 每个条目包含标题和一句话的总结。\n5. 语气客观、专业。"
    },
    tts: {
        enable: false,
        provider: "browser",
        voice: "",
        speed: 1.0
    },
    summary: {
        enable: false,
        cron: "0 8 * * *",
        targetDocId: ""
    }
}
