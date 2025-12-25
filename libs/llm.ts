import { IPluginConfig } from "./settings";

export async function generateSummary(text: string, config: IPluginConfig["llm"]): Promise<string> {
    if (!config.enable || !config.apiKey) {
        throw new Error("LLM service is not enabled or API key is missing.");
    }

    const payload = {
        model: config.model,
        messages: [
            {
                role: "system",
                content: config.prompt
            },
            {
                role: "user",
                content: text
            }
        ],
        temperature: 0.7
    };

    try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`LLM API Error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No summary generated.";
    } catch (error) {
        console.error("LLM Request Failed:", error);
        throw error;
    }
}
