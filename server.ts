import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// In-memory store for uploads (prototype only)
const uploads = new Map<string, { buffer: Buffer, filename: string, totalPages: number }>();

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/upload-pdf", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Read PDF to get page count
      const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();
      const uploadId = Date.now().toString() + "-" + Math.random().toString(36).substring(7);

      uploads.set(uploadId, {
        buffer: req.file.buffer,
        filename: req.file.originalname,
        totalPages
      });

      res.json({
        uploadId,
        filename: req.file.originalname,
        totalPages
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process PDF file." });
    }
  });

  app.post("/api/extract-batch", async (req, res) => {
    try {
      const { uploadId, startPage, endPage } = req.body;
      const fileData = uploads.get(uploadId);

      if (!fileData) {
        return res.status(404).json({ error: "Upload not found" });
      }

      // Slice PDF or use original bytes if entire document is in this batch
      let pdfBytes: Uint8Array;
      // If the batch covers the entire document, don't slice with pdf-lib to preserve scanned PDF integrity
      if (startPage === 1 && endPage >= fileData.totalPages) {
        pdfBytes = fileData.buffer;
      } else {
        const pdfDoc = await PDFDocument.load(fileData.buffer, { ignoreEncryption: true });
        const newPdf = await PDFDocument.create();

        // Pages are 1-indexed in UI, 0-indexed in pdf-lib
        for (let i = startPage - 1; i < endPage && i < fileData.totalPages; i++) {
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
          newPdf.addPage(copiedPage);
        }

        pdfBytes = await newPdf.save();
      }
      
      const base64Pdf = Buffer.from(pdfBytes).toString("base64");

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Pdf
                }
              },
              {
                text: `You are analyzing scanned Environmental Monitoring CoA pages. Read the document visually. Do not depend on embedded/selectable text.
Inspect every visible table row and column.
Do NOT invent data. If a value is unreadable or not present, use null. Blank does NOT mean 0.
Recognize these parameters: "부유입자 ≥0.5 μm", "부유입자 ≥5.0 μm", "부유균", "낙하균", "표면균".
Also extract the room's Cleanliness Grade (e.g. A, B, C, D) if present.
For every valid measurement result, output a structured record. 
Only output numeric values if explicitly stated. Never guess missing values.
Ensure room names are extracted exactly as they appear.`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              records: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    measurement_date: { type: Type.STRING, nullable: true },
                    room_name: { type: Type.STRING, nullable: true },
                    room_grade: { type: Type.STRING, nullable: true },
                    parameter: { type: Type.STRING, nullable: true },
                    result: { type: Type.NUMBER, nullable: true },
                    unit: { type: Type.STRING, nullable: true },
                    alert_limit: { type: Type.NUMBER, nullable: true },
                    action_limit: { type: Type.NUMBER, nullable: true },
                    status: { type: Type.STRING, nullable: true },
                    source_page: { type: Type.INTEGER, nullable: true }
                  }
                }
              }
            }
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
         return res.json({ records: [] });
      }

      const parsed = JSON.parse(responseText);
      
      // Add page offset to source_page since Gemini only saw the sliced PDF
      const adjustedRecords = (parsed.records || []).map((r: any) => {
        if (r.source_page && r.source_page > 0) {
           r.source_page = r.source_page + (startPage - 1);
        }
        return r;
      });

      res.json({ records: adjustedRecords });
    } catch (error: any) {
      console.error("Extraction error:", error);
      let errorType = 'UNKNOWN_ERROR';
      let errorMsg = error.message || "Failed to extract data";
      
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("exhausted")) {
         errorType = 'GEMINI_QUOTA_ERROR';
         errorMsg = "Rate limit exceeded or API quota exhausted.";
      } else if (errorMsg.includes("schema") || errorMsg.includes("JSON") || errorMsg.includes("parse")) {
         errorType = 'INVALID_STRUCTURED_RESPONSE';
         errorMsg = "The AI model returned an invalid structured response.";
      } else if (errorMsg.includes("timeout") || errorMsg.includes("fetch")) {
         errorType = 'NETWORK_ERROR';
      } else {
         errorType = 'GEMINI_API_ERROR';
      }
      
      res.status(500).json({ error: errorMsg, errorType });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
