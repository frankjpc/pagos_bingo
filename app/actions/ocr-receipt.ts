'use server';

import { GoogleGenAI, Type } from '@google/genai';
import { OCRReceiptResult } from '@/lib/types';

// Inicialización del cliente oficial de Google Gen AI SDK
const apiKey = process.env.GEMINI_API_KEY;

export async function procesarComprobantePagoMovil(
  formData: FormData
): Promise<{ success: boolean; data?: OCRReceiptResult; error?: string }> {
  try {
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY no está configurada en las variables de entorno.'
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'No se recibió ningún archivo de imagen.' };
    }

    // Convertir el archivo a base64 para enviarlo inline a Gemini
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const ai = new GoogleGenAI({ apiKey });

    // Definición estricta de JSON Schema para Gemini 1.5 Flash
    const prompt = `Eres un auditor bancario de alta velocidad para un evento masivo.
Analiza minuciosamente la fotografía o captura del comprobante de Pago Móvil o transferencia bancaria en pantalla de teléfono (Venezuela / Interbancario).
Extrae con total exactitud los siguientes campos:
1. banco_origen: Nombre del banco emisor o aplicación desde donde se emitió el pago (ejemplos: "Banesco", "Banco de Venezuela / BDV", "Mercantil", "Banco Provincial / BBVA", "BNC", "Bancaribe", "Bancamiga", etc.). Si no estás seguro, escribe el texto más representativo del encabezado o logotipo del banco.
2. referencia: Secuencia numérica o alfanumérica única de comprobante/referencia (busca etiquetas como "Referencia", "Ref.", "Nro. de Operación", "Secuencia", "Aprobación"). Extrae solo los dígitos o identificador sin palabras extras.
3. monto: El monto monetario pagado expresado como número decimal puro (ejemplo: si dice "Bs. 150,00" o "150.00 Bs", extrae 150.00; si dice "300,50", extrae 300.50). Si usa coma como decimal conviértelo a punto decimal numérico.
4. telefono_origen: Si aparece el teléfono que emite el pago, extráelo.
5. fecha_hora: Fecha y hora exacta registrada en la transacción.
6. confianza: 'alta' si el comprobante es perfectamente legible, 'media' si hay ligeros reflejos pero es legible, o 'baja' si está muy borroso.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1, // Mínima temperatura para garantizar consistencia factual y evitar alucinaciones
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            banco_origen: {
              type: Type.STRING,
              description:
                'Nombre del banco emisor o logotipo visible en el comprobante.',
            },
            referencia: {
              type: Type.STRING,
              description:
                'Código o número de referencia/operación del pago móvil.',
            },
            monto: {
              type: Type.NUMBER,
              description:
                'Valor numérico del monto pagado (número flotante positivo).',
            },
            telefono_origen: {
              type: Type.STRING,
              description: 'Teléfono celular del pagador si es visible.',
            },
            fecha_hora: {
              type: Type.STRING,
              description: 'Fecha y hora que figura en la transacción.',
            },
            confianza: {
              type: Type.STRING,
              enum: ['alta', 'media', 'baja'],
              description: 'Nivel de legibilidad y nitidez de la captura.',
            },
          },
          required: ['banco_origen', 'referencia', 'monto'],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return {
        success: false,
        error: 'Gemini no pudo generar una respuesta estructurada para esta imagen.',
      };
    }

    const parsedData = JSON.parse(responseText) as OCRReceiptResult;

    // Sanear referencia removiendo espacios o caracteres de puntuación molestos
    if (parsedData.referencia) {
      parsedData.referencia = parsedData.referencia.replace(/[^\w\d]/gi, '');
    }

    return {
      success: true,
      data: parsedData,
    };
  } catch (error: any) {
    console.error('Error en procesarComprobantePagoMovil:', error);
    return {
      success: false,
      error:
        error.message ||
        'Ocurrió un error inesperado al procesar la imagen con Gemini 1.5 Flash.',
    };
  }
}

