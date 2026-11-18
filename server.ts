import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Gemini API setup (Interactions API)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const registerExpenseTool: any = {
  type: "function",
  name: "registerExpense",
  description: "Registra un nuevo gasto en el presupuesto del usuario.",
  parameters: {
    type: "object",
    properties: {
      amount: {
        type: "number",
        description: "El monto del gasto (ej: 500, 1500.50).",
      },
      date: {
        type: "string",
        description: "La fecha del gasto en formato YYYY-MM-DD.",
      },
      description: {
        type: "string",
        description: "Una breve descripción del gasto.",
      },
      category: {
        type: "string",
        description: "La categoría del gasto (ej: Alimentación, Transporte, Salud, Entretenimiento, Hogar, Otros).",
      },
    },
    required: ["amount", "date", "description", "category"],
  },
};

const MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest"
];

const getSystemInstruction = (userName: string, balance: number) => `Eres un asistente experto en finanzas personales, breve y amable. 
Tu objetivo es ayudar al usuario a registrar sus gastos. 
Siempre confirma los datos que vas a registrar o que ya registraste. 
Si el usuario no especifica la fecha, asume que es hoy (${new Date().toISOString().split('T')[0]}).
Si no especifica la categoría, intenta inferirla o pregunta.

CONTEXTO ACTUAL:
- Usuario: ${userName}
- Saldo Disponible: $${balance.toLocaleString('es-CO')}
- Fecha Actual: ${new Date().toLocaleDateString('es-CO')}

INSTRUCCIONES ADICIONALES:
- Imagen: permite subir un ticket, recibo, captura de compra o apunte de gasto. Extrae monto, fecha y descripción. Si un dato no se ve o está dudoso, pregunta antes de guardar. No inventes datos.
- Audio: permite grabar o cargar una nota de voz. Transcribe el audio y extrae monto, fecha y descripción. Si falta algún dato, pregunta antes de guardar. No inventes datos.
- Validación: Si el archivo no tiene que ver con gastos o finanzas, indica que no puedes procesarlo.
- Reglas de Registro: Usa siempre la herramienta registerExpense para guardar datos confirmados. Al finalizar un registro, dirígete al usuario por su nombre (ej: '¡Listo, ${userName}! He guardado tu gasto').
- Comparación: Para consultas de compras, compara el gasto solicitado con el saldo disponible proporcionado.
- Si la imagen o el audio no tienen que ver con gastos de Mi Presupuesto responde que no puedes registrarlo.`;

app.post("/api/chat", async (req, res) => {
  const { messages, userName = "Usuario", availableBalance = 0, previousInteractionId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Mensajes no válidos" });
  }

  let lastError: any = null;

  for (const modelName of MODELS) {
    try {
      const lastMessage = messages[messages.length - 1];
      const inputParts: any[] = [];
      
      if (lastMessage.content) {
        inputParts.push({ type: 'text', text: lastMessage.content });
      }
      
      if (lastMessage.fileData) {
        inputParts.push({
          type: lastMessage.fileType === 'image' ? 'image' : 'audio',
          data: lastMessage.fileData.data,
          mime_type: lastMessage.fileData.mimeType
        });
      }

      const interaction = await ai.interactions.create({
        model: modelName,
        input: inputParts,
        system_instruction: getSystemInstruction(userName, availableBalance),
        tools: [registerExpenseTool],
        previous_interaction_id: previousInteractionId,
        store: true
      });

      // Extract function calls from steps
      const functionCalls = interaction.steps
        .filter(s => s.type === 'function_call')
        .map(s => ({
          name: s.name,
          args: s.arguments
        }));

      return res.json({
        content: interaction.output_text || "",
        functionCalls: functionCalls,
        interactionId: interaction.id,
        modelUsed: modelName
      });

    } catch (error: any) {
      console.error(`Error with model ${modelName}:`, error);
      lastError = error;
      
      const status = error.status || error.statusCode || (error.response && error.response.status) || 500;
      const isFallbackable = [429, 503, 404, 500].includes(status);
      
      if (!isFallbackable) {
        break;
      }
    }
  }

  const status = lastError?.status || lastError?.statusCode || 500;
  const message = lastError?.message || "Error interno del servidor";
  
  res.status(status).json({ 
    error: message,
    code: status
  });
});

// Vite middleware and static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
