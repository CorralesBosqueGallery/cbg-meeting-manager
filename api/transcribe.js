import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';

// Disable body parser for file uploads
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    try {
        // Parse the multipart form data
        const form = formidable({
            maxFileSize: 25 * 1024 * 1024, // 25MB limit
        });

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });

        const audioFile = files.audio?.[0] || files.audio;
        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Read the audio file
        const audioData = fs.readFileSync(audioFile.filepath);
        
        // Determine file extension
        let filename = audioFile.originalFilename || 'audio.webm';
        if (!filename.includes('.')) {
            const mimeToExt = {
                'audio/webm': 'webm',
                'audio/mp3': 'mp3',
                'audio/mpeg': 'mp3',
                'audio/wav': 'wav',
                'audio/m4a': 'm4a',
                'audio/mp4': 'm4a',
            };
            const ext = mimeToExt[audioFile.mimetype] || 'webm';
            filename = `audio.${ext}`;
        }

        // Create form data for OpenAI API
        const formData = new FormData();
        formData.append('file', audioData, {
            filename: filename,
            contentType: audioFile.mimetype || 'audio/webm',
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'text');
        
        // Optional: Add prompt for better accuracy with gallery-specific terms
        const prompt = `This is a recording of a Corrales Bosque Gallery meeting. Common terms include: CBG, gallery, cooperative, Square (point of sale), First Sunday, consignment, commission, jurying, bylaws, quorum, treasurer, CAST, AABA.`;
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
            const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
            console.error('OpenAI API error:', error);
            return res.status(response.status).json({ 
                error: error.error?.message || 'Transcription failed' 
            });
        }

        const transcript = await response.text();

        // Clean up temp file
        fs.unlinkSync(audioFile.filepath);

        // Return the transcript
        return res.status(200).json({ 
            transcript,
            duration: audioFile.size / 16000,
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
