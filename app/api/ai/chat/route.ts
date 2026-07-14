import OpenAI from 'openai';
import { NextRequest } from 'next/server';

// The OpenAI client is created server-side only.
// This file runs on your server, never in the browser,
// so the API key stays private.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages, documentContent, selectedText } = await req.json();

    // Build the system prompt -- this is what gives the AI its "personality"
    // and tells it how to behave. The document content is injected here so
    // the AI can reference it when answering questions.
    const systemPrompt = `You are an expert writing assistant embedded in a document editor called Strux. Your job is to help users improve their writing.

${documentContent ? `Here is the current document content:\n---\n${documentContent}\n---` : 'No document content is currently available.'}

${selectedText ? `The user has highlighted this specific text:\n"${selectedText}"` : ''}

Guidelines:
- Be concise and actionable in your suggestions
- When suggesting edits, show the specific text change clearly
- If asked to rewrite something, provide the improved version directly
- Match the tone and style of the existing document
- If no document content is provided, still help with general writing advice`;

    // This is a streaming response. Instead of waiting for the full AI response
    // and sending it all at once (which could take 5-10 seconds of staring at
    // a loading spinner), we stream tokens as they're generated. The user sees
    // text appear word-by-word, just like ChatGPT or Notion AI.
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    // Convert OpenAI's stream into a web-standard ReadableStream.
    // This is the pattern for streaming from Next.js API routes.
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
