const express = require("express");
const cors = require("cors");
const fs = require("fs");
const ejecutarExtraccion = require("./robot"); // Acoplamiento con robot.js
const app = express();

const PUERTO = 3000;
const ARCHIVO_LOG = "registro_bunker.txt";

// CONFIGURACIÓN DE ADUANA (MIDDLEWARES OBLIGATORIOS)
app.use(cors());
app.use(express.json());

let totalEscaneos = 0;
let totalErrores = 0;
let historial = [];

function generarTimestamp() {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  const hora = String(fecha.getHours()).padStart(2, "0");
  const minuto = String(fecha.getMinutes()).padStart(2, "0");
  const segundo = String(fecha.getSeconds()).padStart(2, "0");
  return `${anio}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;
}

function registrarLog(tipo, modulo, mensaje) {
  const linea = `[${generarTimestamp()}] [${tipo}] [${modulo}] ${mensaje}\n`;
  console.log(linea.trim());

  // Escritura asincrónica permanente en disco duro
  fs.appendFile(ARCHIVO_LOG, linea, "utf8", (error) => {
    if (error) console.error("[CRITICO] Error escribiendo log:", error.message);
  });
}

function esURLValida(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// RUTA PRINCIPAL DE ESCANEO
app.post("/api/escanear", async (req, res) => {
  const urlRecibida = req.body.url;

  registrarLog("INFO", "PROCESO", `Objetivo recibido: ${urlRecibida}`);

  if (!urlRecibida) {
    totalErrores++;
    registrarLog("ERROR", "VALIDACION", "URL vacia");
    return res
      .status(400)
      .json({ estado: "ERROR", mensaje: "Debe ingresar una URL." });
  }

  if (!esURLValida(urlRecibida)) {
    totalErrores++;
    registrarLog("ERROR", "VALIDACION", `URL invalida: ${urlRecibida}`);
    return res
      .status(400)
      .json({ estado: "ERROR", mensaje: "La URL ingresada no es valida." });
  }

  try {
    registrarLog("INFO", "ESCANEO", "Inicio del análisis");

    registrarLog("INFO", "ROBOT", "Enviando objetivo al robot");

    // Llamada asincrónica real al Robot
    const datosDelRobot = await ejecutarExtraccion(urlRecibida);

    registrarLog("SUCCESS", "ROBOT", "Escaneo completado exitosamente");

    totalEscaneos++;
    historial.push({
      fecha: generarTimestamp(),
      url: urlRecibida,
      titulo: datosDelRobot.identidad.titulo,
    });

    if (historial.length > 20) historial.shift();

    // Guardado en historial.log requerido
    const lineaHistorial = `[${generarTimestamp()}] OBJETIVO: ${urlRecibida} | TITULO: ${datosDelRobot.identidad.titulo}\n`;
    fs.appendFile("historial.log", lineaHistorial, "utf8", () => {});

    registrarLog(
      "INFO",
      "RETORNO",
      "Despachando JSON estructurado hacia el Frontend",
    );

    // que lea "metricas" o "metrics" sin importar qué idioma use, destrabando la pantalla.
    return res.status(200).json({
      estado: "EXITO",
      mensaje: "Sondas recuperadas. Analisis completado.",
      fechaAnalisis: generarTimestamp(),
      objetivo: urlRecibida,
      identidad: datosDelRobot.identidad,
      tecnologias: datosDelRobot.tecnologias,
      metricas: datosDelRobot.metricas, // Para tu script.js en español
      metrics: datosDelRobot.metricas, // Copia de seguridad en inglés
      enlaces: datosDelRobot.enlaces || [],
    });
  } catch (error) {
    totalErrores++;
    registrarLog("ERROR", "SISTEMA", error.message);

    // Si el robot falla, devolvemos la estructura armada para que el front no lea "undefined"
    return res.status(500).json({
      estado: "ERROR",
      mensaje: "Error interno durante el analisis.",
      identidad: {
        titulo: "Error de Conexión",
        descripcion: "Objetivo inalcanzable",
      },
      tecnologias: {
        servidor: "Error",
        lenguaje: "Error",
        frameworkFront: "Error",
      },
      metricas: {
        tiempoRespuestaMs: 0,
        pesoDocumentoKb: 0,
        certSslVigente: false,
      },
      metrics: {
        tiempoRespuestaMs: 0,
        pesoDocumentoKb: 0,
        certSslVigente: false,
      },
      enlaces: [],
    });
  }
});

// ENDPOINTS EXTRAS DE OBSERVABILIDAD
app.get("/api/historial", (req, res) => {
  res.json({ totalRegistros: historial.length, historial });
});
app.get("/api/estadisticas", (req, res) => {
  res.json({
    estadoServidor: "ONLINE",
    puerto: PUERTO,
    escaneosTotales: totalEscaneos,
    erroresTotales: totalErrores,
  });
});

app.listen(PUERTO, () => {
  registrarLog("INFO", "SISTEMA", "Servidor inicializado correctamente");
  registrarLog("INFO", "SISTEMA", `Escuchando en puerto ${PUERTO}`);
});
