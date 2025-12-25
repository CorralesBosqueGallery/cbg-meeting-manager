export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        const { transcript, agenda } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'No transcript provided' });
        }

        const meetingTypeNames = {
            'member': 'General Membership Meeting',
            'board': 'Board of Directors Meeting',
            'committee': 'Committee Meeting',
            'special': 'Special Meeting'
        };

        const meetingType = meetingTypeNames[agenda?.type] || 'Meeting';
        const meetingDate = agenda?.date || new Date().toISOString().split('T')[0];

        const systemPrompt = `You are a meeting minutes writer. Your job is to convert a transcript into meeting minutes.

CRITICAL RULES:
1. ONLY include information that is ACTUALLY in the transcript
2. Do NOT make up names, topics, or discussions that aren't in the transcript
3. Do NOT invent attendees, motions, or action items
4. If the transcript is very short or just a test, say so - do not create fake content
5. If you cannot identify specific agenda items from the transcript, just summarize what was actually said

Format:
# [Meeting Type] Minutes
**Date:** [date]

## Summary
[Brief summary of what was ACTUALLY discussed in the transcript]

## Discussion
[What was ACTUALLY said - use quotes if helpful]

## Action Items
[ONLY if specific action items were mentioned in the transcript]
- [Person]: [Task] (if mentioned)

If the transcript is just a test recording or doesn't contain meeting content, simply note that.`;

        const userPrompt = `Convert this transcript into meeting minutes. Remember: ONLY include what is actually in the transcript. Do not make up any content.

Meeting Type: ${meetingType}
Date: ${meetingDate}

TRANSCRIPT:
"${transcript}"

Generate minutes based ONLY on the above transcript.`;

        console.log('Generating minutes for transcript length:', transcript.length);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('OpenAI API error:', error);
            return res.status(response.status).json({ 
                error: error.error?.message || 'Minutes generation failed' 
            });
        }

        const result = await response.json();
        const minutes = result.choices[0].message.content;

        // Extract action items
        const actionItems = [];
        const actionSection = minutes.match(/## Action Items[\s\S]*?(?=##|$)/i);
        if (actionSection) {
            const bullets = actionSection[0].match(/[-•]\s*(.+)/g);
            if (bullets) {
                bullets.forEach(bullet => {
                    const text = bullet.replace(/^[-•]\s*/, '');
                    const colonMatch = text.match(/^([^:]+):\s*(.+)/);
                    if (colonMatch) {
                        actionItems.push({
                            assignee: colonMatch[1].trim(),
                            task: colonMatch[2].trim(),
                            dueDate: null
                        });
                    }
                });
            }
        }

        console.log('Minutes generated successfully');
        return res.status(200).json({ minutes, actionItems });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
