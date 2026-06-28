// Receptor-Server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const ejecutarExtraccion = require("./robot");

const app = express();
const PUERTO = 3000;
app.use(cors());
app.use(express.json());
app.post("/api/escanear", async (req, res) => {
  const urlRecibida = req.body.url;
  console.log(`[ALERTA]: Iniciando escaneo en coordenadas: ${urlRecibida}`);
  try {
    const datosDelRobot = await ejecutarExtraccion(urlRecibida);
    const lineaLog = `[${new Date().toISOString()}] OBJETIVO: ${urlRecibida} / TITULO: 
${datosDelRobot.identidad.titulo} / LATENCIA: ${datosDelRobot.metricas.tiempoRespuestaMs}ms / PESO: 
${datosDelRobot.metricas.pesoDocumentoKb}KB/n`;
    fs.appendFileSync("historial.log", lineaLog, "utf8");
    res.json({
      estado: "Exito",
      mensaje: "Sondas recuperadas. Analisis completado.",
      identidad: datosDelRobot.identidad,
      tecnologias: datosDelRobot.tecnologias,
      metricas: datosDelRobot.metricas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.listen(PUERTO, () => {
  console.log(
    `[BUNKER CENTRAL]: Escuchando comunicaciones en puerto ${PUERTO}`,
  );
});
