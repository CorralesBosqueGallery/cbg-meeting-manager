import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
        Header, Footer, PageNumber } from 'docx';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { minutes, agenda, actionItems } = req.body;

        if (!minutes) {
            return res.status(400).json({ error: 'No minutes provided' });
        }

        const meetingTypeNames = {
            'member': 'General Membership Meeting',
            'board': 'Board of Directors Meeting',
            'committee': 'Committee Meeting',
            'special': 'Special Meeting'
        };

        const meetingType = meetingTypeNames[agenda?.type] || 'Meeting';
        const meetingDate = agenda?.date || new Date().toISOString().split('T')[0];

        // Parse markdown into paragraphs
        const contentParagraphs = [];
        const lines = minutes.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                contentParagraphs.push(new Paragraph({ text: '' }));
                continue;
            }

            if (trimmed.startsWith('# ')) {
                contentParagraphs.push(new Paragraph({
                    children: [new TextRun({ text: trimmed.substring(2), bold: true, size: 32 })],
                    spacing: { before: 300, after: 150 },
                }));
            } else if (trimmed.startsWith('## ')) {
                contentParagraphs.push(new Paragraph({
                    children: [new TextRun({ text: trimmed.substring(3), bold: true, size: 26 })],
                    spacing: { before: 250, after: 100 },
                }));
            } else if (trimmed.startsWith('### ')) {
                contentParagraphs.push(new Paragraph({
                    children: [new TextRun({ text: trimmed.substring(4), bold: true, size: 24 })],
                    spacing: { before: 200, after: 80 },
                }));
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                contentParagraphs.push(new Paragraph({
                    children: [new TextRun({ text: '• ' + trimmed.substring(2) })],
                    indent: { left: 360 },
                }));
            } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                contentParagraphs.push(new Paragraph({
                    children: [new TextRun({ text: trimmed.slice(2, -2), bold: true })],
                }));
            } else {
                // Handle inline bold
                const parts = [];
                let remaining = trimmed;
                while (remaining.includes('**')) {
                    const start = remaining.indexOf('**');
                    if (start > 0) {
                        parts.push(new TextRun({ text: remaining.substring(0, start) }));
                    }
                    remaining = remaining.substring(start + 2);
                    const end = remaining.indexOf('**');
                    if (end === -1) {
                        parts.push(new TextRun({ text: '**' + remaining }));
                        remaining = '';
                    } else {
                        parts.push(new TextRun({ text: remaining.substring(0, end), bold: true }));
                        remaining = remaining.substring(end + 2);
                    }
                }
                if (remaining) {
                    parts.push(new TextRun({ text: remaining }));
                }
                contentParagraphs.push(new Paragraph({
                    children: parts.length > 0 ? parts : [new TextRun({ text: trimmed })],
                }));
            }
        }

        const doc = new Document({
            styles: {
                default: {
                    document: {
                        run: { font: 'Arial', size: 24 }
                    }
                }
            },
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
                    }
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [new TextRun({
                                text: 'Corrales Bosque Gallery — Meeting Minutes',
                                italics: true,
                                size: 18,
                                color: '888888'
                            })]
                        })]
                    })
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: 'Page ', size: 18 }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                                new TextRun({ text: ' of ', size: 18 }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })
                            ]
                        })]
                    })
                },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ 
                            text: 'CORRALES BOSQUE GALLERY', 
                            bold: true, 
                            size: 32,
                            color: '2E5A4C'
                        })]
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ 
                            text: meetingType, 
                            size: 28,
                            color: '4A7C6F'
                        })],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: meetingDate })],
                        spacing: { after: 400 }
                    }),
                    ...contentParagraphs,
                    new Paragraph({
                        children: [new TextRun({ 
                            text: 'Minutes generated by CBG Meeting Manager', 
                            italics: true, 
                            size: 18,
                            color: '999999'
                        })],
                        spacing: { before: 400 }
                    })
                ]
            }]
        });

        console.log('Generating Word document...');
        const buffer = await Packer.toBuffer(doc);
        console.log('Word document generated, size:', buffer.length);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="CBG_Minutes_${meetingDate}.docx"`);
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Export error:', error);
        return res.status(500).json({ error: error.message });
    }
}
