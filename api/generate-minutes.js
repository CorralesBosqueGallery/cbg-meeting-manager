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

        // Build the prompt
        const meetingTypeNames = {
            'member': 'General Membership Meeting',
            'board': 'Board of Directors Meeting',
            'committee': 'Committee Meeting',
            'special': 'Special Meeting'
        };

        const meetingType = meetingTypeNames[agenda?.type] || 'Meeting';
        const meetingDate = agenda?.date || 'Unknown Date';

        const agendaText = agenda?.items?.map((item, i) => {
            let text = `${i + 1}. ${item.title}`;
            if (item.isVote) text += ' (VOTE)';
            if (item.subItems?.length) {
                item.subItems.forEach((sub, j) => {
                    text += `\n   ${String.fromCharCode(97 + j)}. ${sub.text}`;
                });
            }
            return text;
        }).join('\n') || 'No agenda provided';

        const systemPrompt = `You are a professional meeting minutes writer for the Corrales Bosque Gallery, an artists' cooperative in New Mexico. Your task is to convert meeting transcripts into clear, well-organized meeting minutes.

Guidelines:
- Use formal but accessible language
- Organize content by agenda items when possible
- Note all motions, who made them, who seconded, and the result (passed/failed/tabled)
- Note attendance/quorum if mentioned
- Identify and extract action items (who will do what, by when)
- Keep the tone professional but warm
- Use the gallery's terminology (CBG, First Sunday, consignment, jurying, etc.)

Format the minutes with clear sections using markdown:
# Meeting Title
## Attendees (if mentioned)
## Agenda Item 1
[content]
## Agenda Item 2
[content]
etc.

At the end, include a section:
## Action Items
- [Person]: [Task] (Due: [date if mentioned])`;

        const userPrompt = `Please convert this transcript into formal meeting minutes.

MEETING INFO:
Type: ${meetingType}
Date: ${meetingDate}
Location: ${agenda?.location || 'Gallery'}

AGENDA:
${agendaText}

TRANSCRIPT:
${transcript}

Please generate:
1. Well-formatted meeting minutes organized by agenda items
2. A list of action items extracted from the discussion

Format the minutes in markdown. For action items, identify WHO is responsible, WHAT they need to do, and WHEN (if mentioned).`;

        // Call OpenAI API
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
                max_tokens: 4000,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
            console.error('OpenAI API error:', error);
            return res.status(response.status).json({ 
                error: error.error?.message || 'Minutes generation failed' 
            });
        }

        const result = await response.json();
        const minutes = result.choices[0].message.content;

        // Extract action items from the minutes
        const actionItems = extractActionItems(minutes);

        return res.status(200).json({ 
            minutes,
            actionItems,
        });

    } catch (error) {
        console.error('Minutes generation error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

function extractActionItems(minutes) {
    const actionItems = [];
    
    // Look for the Action Items section
    const actionSection = minutes.match(/## Action Items[\s\S]*?(?=##|$)/i);
    if (actionSection) {
        // Extract bullet points
        const bullets = actionSection[0].match(/[-•]\s*(.+)/g);
        if (bullets) {
            bullets.forEach(bullet => {
                const text = bullet.replace(/^[-•]\s*/, '');
                
                // Try to parse assignee and task
                const colonMatch = text.match(/^([^:]+):\s*(.+)/);
                if (colonMatch) {
                    const assignee = colonMatch[1].trim();
                    let task = colonMatch[2].trim();
                    let dueDate = null;

                    // Try to extract due date
                    const dueMatch = task.match(/\(Due:?\s*([^)]+)\)/i);
                    if (dueMatch) {
                        dueDate = dueMatch[1].trim();
                        task = task.replace(dueMatch[0], '').trim();
                    }

                    actionItems.push({ assignee, task, dueDate });
                } else {
                    actionItems.push({ assignee: 'Unassigned', task: text, dueDate: null });
                }
            });
        }
    }

    return actionItems;
}
