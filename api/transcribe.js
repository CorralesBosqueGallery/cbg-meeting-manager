import fs from 'fs';
import path from 'path';
import os from 'os';

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
    const boundaryStr = '--' + boundary;
    const bufferStr = buffer.toString('binary');
    
    const sections = bufferStr.split(boundaryStr);
    
    for (let i = 1; i < sections.length; i++) {
        const section = sections[i];
        if (section.trim() === '--' || section.trim() === '') continue;
        
        const headerEndIndex = section.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) continue;
        
        const headerPart = section.substring(0, headerEndIndex);
        const bodyPart = section.substring(headerEndIndex + 4);
        
        const cleanBody = bodyPart.replace(/\r\n$/, '');
        
        const nameMatch = headerPart.match(/name="([^"]+)"/);
        const filenameMatch = headerPart.match(/filename="([^"]+)"/);
        const contentTypeMatch = headerPart.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (nameMatch) {
            const bodyBuffer = Buffer.from(cleanBody, 'binary');
            parts.push({
                name: nameMatch[1],
                filename: filenameMatch ? filenameMatch[1] : null,
                contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
                data: bodyBuffer,
            });
        }
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

    let tempFilePath = null;

    try {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
        
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'No multipart boundary found' });
        }
        
        const boundary = boundaryMatch[1] || boundaryMatch[2];
        const rawBody = await getRawBody(req);
        
        console.log('Raw body size:', rawBody.length);
        
        const parts = parseMultipart(rawBody, boundary);
        
        console.log('Parts found:', parts.map(p => ({ name: p.name, filename: p.filename, size: p.data?.length })));
        
        const audioPart = parts.find(p => p.name === 'audio' && p.data && p.data.length > 0);
        
        if (!audioPart) {
            return res.status(400).json({ error: 'No audio file found' });
        }

        // Determine file extension from original filename
        let ext = 'mp3';
        if (audioPart.filename) {
            const match = audioPart.filename.match(/\.(\w+)$/);
            if (match) ext = match[1].toLowerCase();
        }
        
        // Map extensions to what OpenAI expects
        const extMap = {
            'm4a': 'm4a',
            'mp3': 'mp3',
            'mp4': 'mp4',
            'mpeg': 'mpeg',
            'mpga': 'mpga',
            'wav': 'wav',
            'webm': 'webm',
            'ogg': 'ogg',
            'oga': 'oga',
            'flac': 'flac',
        };
        ext = extMap[ext] || 'mp3';

        // Write to temp file with correct extension
        tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.${ext}`);
