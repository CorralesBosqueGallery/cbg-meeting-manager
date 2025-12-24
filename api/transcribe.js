export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function parseMultipart(buffer, boundary) {
    const parts = [];
    const boundaryBuffer = Buffer.from('--' + boundary);
    
    let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length;
    
    while (start < buffer.length) {
        let end = buffer.indexOf(boundaryBuffer, start);
        if (end === -1) break;
        
        const part = buffer.slice(start, end);
        
        let headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            start = end + boundaryBuffer.length;
            continue;
        }
        
        const headerSection = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4, -2);
        
        const nameMatch = headerSection.match(/name="([^"]+)"/);
        const filenameMatch = headerSection.match(/filename="([^"]+)"/);
        const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (nameMatch) {
            parts.push({
                name: nameMatch[1],
                filename: filenameMatch ? filenameMatch[1] : null,
                contentType: contentTypeMatch ? contentTypeMatch[1] : null,
                data: body,
            });
        }
        
        start = end + boundaryBuffer.length;
    }
    
    return parts;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
        
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'No multipart boundary found' });
        }
        
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const rawBody = await getRawBody(req);
        const parts = parseMultipart(rawBody, boundary);
        
        const audioPart = parts.find(p => p.name === 'audio' && p.data && p.data.length > 0);
        
        if (!audioPart) {
            return res.status(400).json({ 
                error: 'No audio file found',
                partsFound: parts.map(p => ({ name: p.name, size: p.data?.length || 0 }))
            });
        }

        // Use .wav extension which OpenAI handles well
        const filename = 'audio.wav';
        
        console.log('Audio size:', audioPart.data.length, 'bytes');

        // Use native FormData (available in Node 18+)
        const formData = new FormData();
        
        // Create a Blob from the buffer
        const audioBlob = new Blob([audioPart.data], { type: 'audio/wav' });
        formData.append('file', audioBlob, filename);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');

        // Call OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
            console.error('OpenAI API error:', errorData);
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'Transcription failed' 
            });
        }

        const transcript = await response.text();

        return res.status(200).json({ 
            transcript,
            filename: filename,
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
