import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, context, maxTokens = 1000 } = await req.json();

        if (!prompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("XAI_API_KEY");
        if (!apiKey) {
            console.error("XAI_API_KEY not set");
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }

        const messages = [];
        if (context) {
            messages.push({
                role: "system",
                content: context
            });
        }
        messages.push({
            role: "user",
            content: prompt
        });

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "grok-beta",
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("x.ai API error:", error);
            return Response.json({ 
                error: 'Failed to generate response from Grok',
                details: error
            }, { status: response.status });
        }

        const data = await response.json();
        const generatedText = data.choices?.[0]?.message?.content;

        if (!generatedText) {
            console.error("No content in response:", data);
            return Response.json({ error: 'No response generated' }, { status: 500 });
        }

        return Response.json({ 
            text: generatedText,
            usage: data.usage 
        });

    } catch (error) {
        console.error("Grok assistant error:", error);
        return Response.json({ 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
});