// Receptor-Server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const ejecutarExtraccion = require("./robot");
const MENSAJES = require("./mensajes");

const app = express();
const PUERTO = 3000;
const TIMEOUT_LIMITE = 15000; // 15 segundos: el tiempo máximo de misión

app.use(cors());
app.use(express.json());

function registrarLog(tipo, modulo, mensaje) {
  const timestamp = new Date().toISOString();
  const linea = `[${timestamp}] [${tipo.toUpperCase()}] [${modulo}]: ${mensaje}\n`;
  console.log(linea.trim());

  // Mantenemos la lógica de persistencia del profesor
  fs.appendFile("registro_bunker.txt", linea, (err) => {
    if (err) console.error(err);
  });
}

async function lanzarSondaConTimeout(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("TIMEOUT_ROBOT")),
      TIMEOUT_LIMITE,
    );

    ejecutarExtraccion(url)
      .then((data) => {
        clearTimeout(timer);
        resolve(data);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

app.post("/api/escanear", async (req, res) => {
  const urlRecibida = req.body.url;
  registrarLog(
    "ALERTA",
    "BUNKER",
    `Iniciando escaneo en coordenadas: ${urlRecibida}`,
  );

  if (!urlRecibida) {
    return res
      .status(400)
      .json({ estado: "URL_VACIA", mensaje: MENSAJES.url_vacia });
  }

  try {
    const datosDelRobot = await lanzarSondaConTimeout(urlRecibida);

    const lineaLog = `[${new Date().toISOString()}] OBJETIVO: ${urlRecibida} / TITULO: ${datosDelRobot.identidad.titulo} / LATENCIA: ${datosDelRobot.metricas.tiempoRespuestaMs}ms / PESO: ${datosDelRobot.metricas.pesoDocumentoKb}KB\n`;
    fs.appendFileSync("historial.log", lineaLog, "utf8");

    res.json({
      estado: "EXITO",
      mensaje: MENSAJES.escaneo_exitoso,
      ...datosDelRobot,
    });
  } catch (error) {
    // Claridad para el backend: distinguimos si es timeout o un error del robot
    const tipoError =
      error.message === "TIMEOUT_ROBOT" ? "TIMEOUT_ROBOT" : "ERROR_SISTEMA";
    registrarLog("ERROR", "BUNKER", `Fallo en ${urlRecibida}: ${tipoError}`);

    res.status(500).json({
      estado: tipoError,
      mensaje:
        tipoError === "TIMEOUT_ROBOT"
          ? "La sonda no respondió a tiempo"
          : MENSAJES.error_reintento,
    });
  }
});

app.listen(PUERTO, () => {
  registrarLog(
    "INFO",
    "BUNKER",
    `Escuchando comunicaciones en puerto ${PUERTO}`,
  );
});
