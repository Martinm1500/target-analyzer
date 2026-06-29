const express = require("express");
const cors = require("cors");
const fs = require("fs");
const ejecutarExtraccion = require("./robot"); // Acoplamiento con robot.js
const app = express();

const PUERTO = 3000;
const ARCHIVO_LOG = "registro_bunker.txt";
const MENSAJES = require("./mensajes");

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

// En caso de error retornamos una respuesta prederminada para que el frontend tenga algo que renderizar y no un mensaje de error
function respuestaError(mensaje) {
  return {
    estado: "ERROR",
    mensaje: mensaje,
    identidad: {
      titulo: MENSAJES.sin_contenido,
      descripcion: MENSAJES.sin_descripcion,
    },
    tecnologias: {
      servidor: MENSAJES.desconocido,
      lenguaje: MENSAJES.desconocido,
      frameworkFront: MENSAJES.desconocido,
    },
    metricas: {
      tiempoRespuestaMs: 0,
      pesoDocumentoKb: 0,
      certSslVigente: false,
    },
    enlaces: MENSAJES.sin_enlaces,
    imagenes: MENSAJES.sin_imagenes,
    // El robot puede detectar imágenes a través de la etiqueta de img. Devuelve una lista con las urls. puppeteer se encarga de esto, pero no esta implementado en el mvp
  };
}

// RUTA PRINCIPAL DE ESCANEO
app.post("/api/escanear", async (req, res) => {
  const urlRecibida = req.body.url;

  registrarLog("INFO", "PROCESO", `Objetivo recibido: ${urlRecibida}`);

  if (!urlRecibida) {
    totalErrores++;
    registrarLog("ERROR", "VALIDACION", "URL vacia");
    return res.status(400).json(respuestaError(MENSAJES.url_vacia));
  }

  if (!esURLValida(urlRecibida)) {
    totalErrores++;
    registrarLog("ERROR", "VALIDACION", `URL invalida: ${urlRecibida}`);
    return res.status(400).json(respuestaError(MENSAJES.url_invalida));
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

    return res.status(200).json({
      estado: "EXITO",
      mensaje: MENSAJES.escaneo_exitoso,
      fechaAnalisis: generarTimestamp(),
      objetivo: urlRecibida,
      identidad: {
        titulo: datosDelRobot.identidad.titulo || MENSAJES.sin_titulo,
        descripcion:
          datosDelRobot.identidad.descripcion || MENSAJES.sin_descripcion,
      },
      tecnologias: {
        servidor: datosDelRobot.tecnologias.servidor || MENSAJES.desconocido,
        lenguaje: datosDelRobot.tecnologias.lenguaje || MENSAJES.desconocido,
        frameworkFront:
          datosDelRobot.tecnologias.frameworkFront || MENSAJES.desconocido,
      },
      metricas: datosDelRobot.metricas,
      enlaces: datosDelRobot.enlaces || MENSAJES.sin_enlaces,
      imagenes: datosDelRobot.imagenes || MENSAJES.sin_imagenes,
    });
  } catch (error) {
    totalErrores++;
    registrarLog("ERROR", "SISTEMA", error.message);

    return res.status(500).json(respuestaError(MENSAJES.error_reintento));
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
