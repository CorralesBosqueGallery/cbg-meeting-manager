import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        // Parse the multipart form data with explicit options
        const form = formidable({
            maxFileSize: 25 * 1024 * 1024,
            keepExtensions: true,
            allowEmptyFiles: false,
            multiples: false,
        });

        let fields, files;
        try {
            [fields, files] = await form.parse(req);
        } catch (parseError) {
            console.error('Form parse error:', parseError);
            return res.status(400).json({ error: 'Could not parse multipart form: ' + parseError.message });
        }

        console.log('Files received:', JSON.stringify(files, null, 2));

        // Handle different possible file structures
        let audioFile = files.audio;
        if (Array.isArray(audioFile)) {
            audioFile = audioFile[0];
        }
        
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided. Files received: ' + Object.keys(files).join(', ') });
        }

        // Read the audio file
        const audioData = fs.readFileSync(audioFile.filepath);
        
        // Determine file extension
        let filename = audioFile.originalFilename || 'audio.webm';
        const mimeType = audioFile.mimetype || 'audio/webm';
        
        if (!filename.includes('.')) {
            const mimeToExt = {
                'audio/webm': 'webm',
                'audio/mp3': 'mp3',
                'audio/mpeg': 'mp3',
                'audio/wav': 'wav',
                'audio/wave': 'wav',
                'audio/x-wav': 'wav',
                'audio/m4a': 'm4a',
                'audio/mp4': 'm4a',
                'audio/x-m4a': 'm4a',
            };
            const ext = mimeToExt[mimeType] || 'webm';
            filename = `audio.${ext}`;
        }

        console.log('Processing file:', filename, 'Size:', audioData.length, 'Type:', mimeType);

        // Create form data for OpenAI API
        const formData = new FormData();
        formData.append('file', audioData, {
            filename: filename,
            contentType: mimeType,
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'text');
        
        const prompt = `This is a recording of a Corrales Bosque Gallery meeting. Common terms include: CBG, gallery, cooperative, Square, First Sunday, consignment, commission, jurying, bylaws, quorum, treasurer.`;
        formData.append('prompt', prompt);

        // Call OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...formData.getHeaders(),
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

        // Clean up temp file
        try {
            fs.unlinkSync(audioFile.filepath);
        } catch (e) {
            console.warn('Could not delete temp file:', e.message);
        }

        return res.status(200).json({ 
            transcript,
            filename: filename,
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
