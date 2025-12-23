const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
        Header, Footer, PageNumber, BorderStyle, Table, TableRow, TableCell,
        WidthType, ShadingType } = require('docx');

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
        const meetingDate = agenda?.date || 'Unknown Date';
        const meetingLocation = agenda?.location || 'Gallery';

        // Parse the markdown-formatted minutes into document elements
        const contentParagraphs = parseMinutesToParagraphs(minutes);

        // Create action items table if we have any
        const actionItemsSection = actionItems?.length > 0 ? createActionItemsSection(actionItems) : [];

        const doc = new Document({
            styles: {
                default: {
                    document: {
                        run: { font: 'Arial', size: 24 }
                    }
                },
                paragraphStyles: [
                    {
                        id: 'Title',
                        name: 'Title',
                        basedOn: 'Normal',
                        run: { size: 36, bold: true, color: '2E5A4C' },
                        paragraph: { spacing: { after: 120 }, alignment: AlignmentType.CENTER }
                    },
                    {
                        id: 'Heading1',
                        name: 'Heading 1',
                        basedOn: 'Normal',
                        run: { size: 28, bold: true, color: '2E5A4C' },
                        paragraph: { spacing: { before: 240, after: 120 } }
                    },
                    {
                        id: 'Heading2',
                        name: 'Heading 2',
                        basedOn: 'Normal',
                        run: { size: 24, bold: true, color: '4A7C6F' },
                        paragraph: { spacing: { before: 200, after: 100 } }
                    }
                ]
            },
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
                    }
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.RIGHT,
                                children: [
                                    new TextRun({
                                        text: 'Corrales Bosque Gallery — Meeting Minutes',
                                        italics: true,
                                        size: 18,
                                        color: '888888'
                                    })
                                ]
                            })
                        ]
                    })
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: 'Page ', size: 18 }),
                                    new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                                    new TextRun({ text: ' of ', size: 18 }),
                                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })
                                ]
                            })
                        ]
                    })
                },
                children: [
                    // Header
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: 'CORRALES BOSQUE GALLERY', bold: true, size: 32, color: '2E5A4C' })
                        ]
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                        children: [
                            new TextRun({ text: meetingType, size: 28, color: '4A7C6F' })
                        ]
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                        children: [
                            new TextRun({ text: `${meetingDate} — ${meetingLocation}`, size: 24 })
                        ]
                    }),

                    // Meeting minutes content
                    ...contentParagraphs,

                    // Action items section
                    ...actionItemsSection,

                    // Footer note
                    new Paragraph({
                        spacing: { before: 400 },
                        children: [
                            new TextRun({
                                text: 'Minutes generated by CBG Meeting Manager',
                                italics: true,
                                size: 18,
                                color: '999999'
                            })
                        ]
                    })
                ]
            }]
        });

        // Generate the document
        const buffer = await Packer.toBuffer(doc);

        // Send the file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=CBG_Minutes_${meetingDate}.docx`);
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Export error:', error);
        return res.status(500).json({ error: error.message || 'Export failed' });
    }
}

function parseMinutesToParagraphs(markdown) {
    const paragraphs = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) {
            // Empty line - add spacing
            paragraphs.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
            continue;
        }

        // Check for headings
        if (trimmedLine.startsWith('# ')) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun(trimmedLine.substring(2))]
            }));
        } else if (trimmedLine.startsWith('## ')) {
            paragraphs.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun(trimmedLine.substring(3))]
            }));
        } else if (trimmedLine.startsWith('### ')) {
            paragraphs.push(new Paragraph({
                spacing: { before: 160, after: 80 },
                children: [new TextRun({ text: trimmedLine.substring(4), bold: true })]
            }));
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
            // Bullet point
            paragraphs.push(new Paragraph({
                indent: { left: 360 },
                children: [
                    new TextRun({ text: '• ', bold: true }),
                    ...parseInlineFormatting(trimmedLine.substring(2))
                ]
            }));
        } else if (trimmedLine.match(/^\d+\.\s/)) {
            // Numbered item
            paragraphs.push(new Paragraph({
                indent: { left: 360 },
                children: parseInlineFormatting(trimmedLine)
            }));
        } else {
            // Regular paragraph
            paragraphs.push(new Paragraph({
                spacing: { after: 100 },
                children: parseInlineFormatting(trimmedLine)
            }));
        }
    }

    return paragraphs;
}

function parseInlineFormatting(text) {
    const runs = [];
    let currentText = '';
    let i = 0;

    while (i < text.length) {
        // Check for bold (**text**)
        if (text.substring(i, i + 2) === '**') {
            // Save any accumulated text
            if (currentText) {
                runs.push(new TextRun(currentText));
                currentText = '';
            }
            
            // Find closing **
            const closeIndex = text.indexOf('**', i + 2);
            if (closeIndex !== -1) {
                runs.push(new TextRun({ text: text.substring(i + 2, closeIndex), bold: true }));
                i = closeIndex + 2;
                continue;
            }
        }
        
        // Check for italic (*text* or _text_)
        if ((text[i] === '*' || text[i] === '_') && text[i + 1] !== '*') {
            if (currentText) {
                runs.push(new TextRun(currentText));
                currentText = '';
            }
            
            const marker = text[i];
            const closeIndex = text.indexOf(marker, i + 1);
            if (closeIndex !== -1) {
                runs.push(new TextRun({ text: text.substring(i + 1, closeIndex), italics: true }));
                i = closeIndex + 1;
                continue;
            }
        }

        currentText += text[i];
        i++;
    }

    if (currentText) {
        runs.push(new TextRun(currentText));
    }

    return runs.length > 0 ? runs : [new TextRun(text)];
}

function createActionItemsSection(actionItems) {
    const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
    const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

    const rows = [
        // Header row
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    borders: cellBorders,
                    shading: { fill: '2E5A4C', type: ShadingType.CLEAR },
                    width: { size: 2000, type: WidthType.DXA },
                    children: [new Paragraph({
                        children: [new TextRun({ text: 'Assigned To', bold: true, color: 'FFFFFF' })]
                    })]
                }),
                new TableCell({
                    borders: cellBorders,
                    shading: { fill: '2E5A4C', type: ShadingType.CLEAR },
                    width: { size: 5000, type: WidthType.DXA },
                    children: [new Paragraph({
                        children: [new TextRun({ text: 'Task', bold: true, color: 'FFFFFF' })]
                    })]
                }),
                new TableCell({
                    borders: cellBorders,
                    shading: { fill: '2E5A4C', type: ShadingType.CLEAR },
                    width: { size: 2000, type: WidthType.DXA },
                    children: [new Paragraph({
                        children: [new TextRun({ text: 'Due Date', bold: true, color: 'FFFFFF' })]
                    })]
                })
            ]
        }),
        // Data rows
        ...actionItems.map((item, index) => new TableRow({
            children: [
                new TableCell({
                    borders: cellBorders,
                    shading: index % 2 === 1 ? { fill: 'F5F5F5', type: ShadingType.CLEAR } : undefined,
                    width: { size: 2000, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun(item.assignee || 'Unassigned')] })]
                }),
                new TableCell({
                    borders: cellBorders,
                    shading: index % 2 === 1 ? { fill: 'F5F5F5', type: ShadingType.CLEAR } : undefined,
                    width: { size: 5000, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun(item.task)] })]
                }),
                new TableCell({
                    borders: cellBorders,
                    shading: index % 2 === 1 ? { fill: 'F5F5F5', type: ShadingType.CLEAR } : undefined,
                    width: { size: 2000, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun(item.dueDate || '—')] })]
                })
            ]
        }))
    ];

    return [
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400 },
            children: [new TextRun('Action Items')]
        }),
        new Table({
            columnWidths: [2000, 5000, 2000],
            rows
        })
    ];
}
