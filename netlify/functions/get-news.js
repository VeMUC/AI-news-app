// netlify/functions/get-news.js
import fetch from 'node-fetch';

// Handler für die Serverless Function
exports.handler = async function(event, context) {
    // API-Schlüssel sicher aus den Umgebungsvariablen von Netlify abrufen
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key is not configured.' })
        };
    }

    try {
        // Berechne das heutige und gestrige Datum
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const todayFormatted = formatDate(today);
        const yesterdayFormatted = formatDate(yesterday);

        // Der Prompt für das Sprachmodell, auf Deutsch
        const prompt = `
            Finde die 3 bis 5 bemerkenswertesten Nachrichten des aktuellen Tages über Künstliche Intelligenz und relevante KI-Unternehmen.
            Fokusbereiche sind: Technologische Durchbrüche, Unternehmensentwicklungen, Marktverändernde Ereignisse.
            Geografischer Fokus: USA, Europa.
            Priorisiere seriöse und renommierte Tech- und Wirtschaftsmedien wie: TechCrunch, The Verge, MIT Technology Review, Financial Times, Reuters, Bloomberg, spezialisierte KI-Blogs und -Newsletter mit hohem Ansehen.
            **Wichtig:** Berücksichtige nur Artikel, die am ${todayFormatted} oder ${yesterdayFormatted} veröffentlicht wurden.

            Für jede Nachricht gib folgende Informationen im JSON-Format zurück:
            {
                "headline": "Kurzer, aussagekräftiger Titel der Nachricht auf Deutsch.",
                "category": "Eine kurze Angabe, ob es sich um eine 'Technologie', 'Unternehmen' oder 'Markt'-Nachricht handelt, auf Deutsch.",
                "summary": "Eine prägnante Zusammenfassung (maximal 70-100 Wörter) auf Deutsch, die die Kerninformationen und die Bedeutung hervorhebt.",
                "source": "Name der Originalquelle (z.B. TechCrunch).",
                "link": "Ein direkter, anklickbarer Link zum vollständigen Artikel der Originalquelle.",
                "publicationDate": "Datum der Veröffentlichung im Format YYYY-MM-DD."
            }
            Gib nur das JSON-Array zurück, ohne zusätzlichen Text.
        `;

        const chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });

        const payload = {
            contents: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            "headline": { "type": "STRING" },
                            "category": { "type": "STRING" },
                            "summary": { "type": "STRING" },
                            "source": { "type": "STRING" },
                            "link": { "type": "STRING" },
                            "publicationDate": { "type": "STRING" }
                        },
                        "propertyOrdering": ["headline", "category", "summary", "source", "link", "publicationDate"]
                    }
                }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API-Fehler: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const jsonString = result.candidates[0].content.parts[0].text;
        const newsData = JSON.parse(jsonString);

        // Filtere Nachrichten, um nur Artikel von heute oder gestern einzuschließen
        const filteredNews = newsData.filter(news => {
            return news.publicationDate === todayFormatted || news.publicationDate === yesterdayFormatted;
        });

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*' // <- Dies ist der wichtige neue Header
            },
            body: JSON.stringify(filteredNews)
        };

    } catch (error) {
        console.error("Fehler beim Abrufen der Nachrichten:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*' // <- Dies ist der wichtige neue Header
            },
            body: JSON.stringify({ error: `Fehler beim Laden der Nachrichten: ${error.message}` })
        };
    }
};
