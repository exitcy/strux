import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { comment, highlightedText, surroundingContext, documentContext } = await req.json();
    const fullContext =
      typeof documentContext === 'string' && documentContext.length > 0
        ? documentContext
        : surroundingContext;

    // This endpoint is scoped -- it only sends the relevant paragraph + context
    // to OpenAI, not the whole document. Cheaper and more focused.
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert writing assistant. A reviewer has left feedback on a document. Your job is to rewrite ONLY the specific paragraph they're commenting on to address their feedback.

Rules:
- Return ONLY the rewritten paragraph text, nothing else
- No explanations, no preamble, no "Here's the revised version:"
- Keep the same general length unless the feedback asks to shorten/lengthen
- Match the existing writing style
- Only change what's needed to address the feedback`,
        },
        {
          role: 'user',
          content: `Reviewer's comment: "${comment}"

${highlightedText ? `Paragraph to revise:\n"${highlightedText}"` : ''}

${surroundingContext ? `Surrounding context for tone matching:\n"${surroundingContext}"` : ''}

${fullContext && fullContext !== surroundingContext ? `Full document for architectural context:\n"""${fullContext.slice(0, 12000)}"""` : ''}

Rewrite the paragraph to address the reviewer's feedback:`,
        },
      ],
    });

    const proposedText = response.choices[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({ proposedText });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI suggestion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
