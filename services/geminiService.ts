
import { GoogleGenAI, Type } from "@google/genai";
import { Lead, LeadSourceType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getUserLocation = (): Promise<{latitude: number, longitude: number} | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
};

export const searchForLeads = async (query: string, sources: LeadSourceType[], userPitch: string): Promise<Partial<Lead>[]> => {
  try {
    const location = await getUserLocation();
    
    const sourceInstructions = sources.map(s => {
      switch(s) {
        case 'linkedin': return "Priorise LinkedIn pour identifier les décideurs.";
        case 'directories': return "Vérifie les annuaires pro comme Kompass ou Infogreffe.";
        default: return "Scan web global.";
      }
    }).join(" ");

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: `TACHE : Recherche et QUALIFICATION de prospects B2B.
      
      REQUÊTE DE RECHERCHE : "${query}"
      NOTRE OFFRE (PITCH) : "${userPitch}"
      SOURCES : ${sources.join(", ")}
      
      DIRECTIVES :
      1. Identifie des entreprises correspondant à la requête.
      2. Pour CHAQUE entreprise, évalue sa pertinence par rapport à NOTRE OFFRE.
      3. Attribue un "qualificationScore" de 0 à 100.
      4. Explique brièvement pourquoi dans "qualificationReason".
      
      IMPORTANT : Extraire Nom, Contact (si possible), Email (si possible), Site Web et Description.

      Retourne UNIQUEMENT un tableau JSON :
      [{
        "companyName": "string",
        "contactName": "string or null",
        "website": "string",
        "description": "string",
        "email": "string or null",
        "qualificationScore": number,
        "qualificationReason": "string (ex: 'Besoin probable de digitalisation')"
      }]`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("JSON Parse Error sourcing leads:", response.text);
      return [];
    }
  } catch (error) {
    console.error("Search Error:", error);
    throw error;
  }
};

export const generateLeadEmail = async (lead: Lead, additionalInstructions?: string) => {
  const prompt = `
    Rôle : SDR Expert en prospection B2B.
    Cible : ${lead.companyName} (${lead.description})
    Qualification : ${lead.qualificationReason} (Score: ${lead.qualificationScore}/100)
    Offre à vendre : ${lead.offeringDetails || "Solutions business innovantes"}

    Tâche : Générer 2 variantes d'emails hautement personnalisées.
    Note : Utilise les éléments de qualification pour montrer que nous avons étudié leur cas.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          variantA: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ["subject", "body"]
          },
          variantB: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ["subject", "body"]
          }
        },
        required: ["variantA", "variantB"],
      },
    },
  });

  return JSON.parse(response.text);
};
