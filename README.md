# CBG Meeting Manager

Meeting recording, transcription, and minutes generation for Corrales Bosque Gallery.

## Features

- **Create Agenda**: Build meeting agendas with standard templates
- **Record Audio**: Record directly in browser or upload audio files
- **AI Transcription**: Automatic transcription using OpenAI Whisper
- **Generate Minutes**: AI-powered meeting minutes with action item extraction
- **Export**: Download as Word document or PDF

## Setup

### 1. Create GitHub Repository

1. Go to github.com/CorralesBosqueGallery
2. Click "New Repository"
3. Name: `cbg-meeting-manager`
4. Set to Private (or Public)
5. Create repository

### 2. Push Code to GitHub

```bash
cd cbg-meeting-manager
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/CorralesBosqueGallery/cbg-meeting-manager.git
git push -u origin main
```

### 3. Deploy to Vercel

1. Go to vercel.com and sign in
2. Click "Add New Project"
3. Import from GitHub: `CorralesBosqueGallery/cbg-meeting-manager`
4. Configure Environment Variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
5. Click "Deploy"

### 4. Environment Variables

In Vercel Dashboard > Project Settings > Environment Variables, add:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-...your-key...` |

## Usage

### Recording a Meeting

1. **Before the meeting**: Create an agenda (or load the standard template)
2. **During the meeting**: Click "Record" to capture audio
3. **After the meeting**: 
   - Stop recording
   - Go to "Transcribe" tab and click "Start Transcription"
   - Go to "Minutes" tab and click "Generate Minutes"
4. **Export**: Download as Word document for editing/distribution

### Uploading a Recording

If you recorded on a phone or Zoom:
1. Go to "Record" tab
2. Drag and drop the audio file (or click to browse)
3. Proceed with transcription as above

## Cost Estimate

- Whisper transcription: ~$0.006 per minute of audio
- GPT-4o-mini for minutes: ~$0.10-0.30 per meeting

A typical 1-hour meeting costs less than $0.50 total.

## Files

```
cbg-meeting-manager/
├── index.html          # Main application
├── api/
│   ├── transcribe.js   # Whisper API integration
│   ├── generate-minutes.js  # GPT minutes generation
│   └── export-word.js  # Word document export
├── package.json
├── vercel.json
└── README.md
```

## Troubleshooting

### "Microphone access denied"
- Click the lock icon in your browser's address bar
- Allow microphone access for this site

### "Transcription failed"
- Check that your OpenAI API key is valid
- Ensure you have credit in your OpenAI account
- Check file size (max 25MB)

### "No audio recorded"
- Some browsers block autoplay; ensure you click the record button
- Try using Chrome for best compatibility

## Support

For issues or questions, contact the gallery's IT administrator.
