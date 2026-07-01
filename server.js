const express = require("express");
const cors = require("cors");
const fs = require("fs");
const ejecutarExtraccion = require("./robot");
const app = express();

const PUERTO = 3000;
const ARCHIVO_LOG = "registro_bunker.txt";
const TIMEOUT_LIMITE = 15000;

// MENSAJES
const MSG_URL_VACIA = "Debe ingresar una URL";
const MSG_URL_INVALIDA = "URL inválida";
const MSG_ESCANEO_EXITOSO = "Sondas recuperadas. Análisis completado.";
const MSG_ERROR_REINTENTO = "Volver a intentar";
const MSG_SIN_TITULO = "No hay título para mostrar";
const MSG_SIN_DESCRIPCION = "Sin descripción";
const MSG_SIN_CONTENIDO = "No hay contenido para mostrar";
const MSG_SIN_ENLACES = "No hay enlaces que mostrar";
const MSG_SIN_IMAGENES = "No hay imágenes que mostrar";
const MSG_DESCONOCIDO = "Desconocido";
const MSG_INALCANZABLE = "Objetivo inalcanzable";

// ESTADOS GENERALES DE RESPUESTA
const ESTADO_EXITO = "EXITO";
const ESTADO_ERROR = "ERROR";

// CÓDIGO INTERNO
const ERR_INTERNO_TIMEOUT = "TIMEOUT_ROBOT";

// CÓDIGOS PÚBLICOS
const COD_ESCANEO_OK = "ESCANEO_OK";
const COD_URL_VACIA = "URL_VACIA";
const COD_URL_INVALIDA = "URL_INVALIDA";
const COD_TIMEOUT = "TIMEOUT";
const COD_ERROR_SISTEMA = "ERROR_SISTEMA";

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

  fs.appendFile(ARCHIVO_LOG, linea, "utf8", (error) => {
    if (error) console.error("[CRITICO] Error escribiendo log:", error.message);
  });
}

async function lanzarSondaConTimeout(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(ERR_INTERNO_TIMEOUT)),
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

function esURLValida(url) {
  if (!url.startsWith("https://") && !url.startsWith("http://"))
    url = "https://" + url;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function respuestaError(codigo, mensaje) {
  return {
    estado: ESTADO_ERROR,
    codigo: codigo,
    mensaje: mensaje,
    identidad: {
      titulo: MSG_SIN_CONTENIDO,
      descripcion: MSG_SIN_DESCRIPCION,
    },
    tecnologias: {
      servidor: MSG_DESCONOCIDO,
      lenguaje: MSG_DESCONOCIDO,
      frameworkFront: MSG_DESCONOCIDO,
    },
    metricas: {
      tiempoRespuestaMs: 0,
      pesoDocumentoKb: 0,
      certSslVigente: false,
    },
    enlaces: MSG_SIN_ENLACES,
    imagenes: MSG_SIN_IMAGENES,
  };
}

// RUTA PRINCIPAL DE ESCANEO
app.post("/api/escanear", async (req, res) => {
  const urlRecibida = req.body.url;

  registrarLog("INFO", "PROCESO", `Objetivo recibido: ${urlRecibida}`);

  if (!urlRecibida || typeof urlRecibida !== "string") {
    totalErrores++;
    registrarLog(COD_URL_VACIA, "VALIDACION", "URL vacia o tipo invalido");
    return res.status(400).json(respuestaError(COD_URL_VACIA, MSG_URL_VACIA));
  }

  if (!esURLValida(urlRecibida)) {
    totalErrores++;
    registrarLog(
      COD_URL_INVALIDA,
      "VALIDACION",
      `URL invalida: ${urlRecibida}`,
    );
    return res
      .status(400)
      .json(respuestaError(COD_URL_INVALIDA, MSG_URL_INVALIDA));
  }

  try {
    registrarLog("INFO", "ESCANEO", "Inicio del análisis");
    registrarLog("INFO", "ROBOT", "Enviando objetivo al robot");

    const datosDelRobot = await lanzarSondaConTimeout(urlRecibida);

    registrarLog("SUCCESS", "ROBOT", "Escaneo completado exitosamente");

    totalEscaneos++;
    historial.push({
      fecha: generarTimestamp(),
      url: urlRecibida,
      titulo: datosDelRobot?.identidad?.titulo || MSG_SIN_TITULO,
    });

    if (historial.length > 20) historial.shift();

    const lineaHistorial = `[${generarTimestamp()}] OBJETIVO: ${urlRecibida} | TITULO: ${datosDelRobot?.identidad?.titulo || MSG_SIN_TITULO}\n`;
    fs.appendFile("historial.log", lineaHistorial, "utf8", () => {});

    registrarLog(
      "INFO",
      "RETORNO",
      "Despachando JSON estructurado hacia el Frontend",
    );

    return res.status(200).json({
      estado: ESTADO_EXITO,
      codigo: COD_ESCANEO_OK,
      mensaje: MSG_ESCANEO_EXITOSO,
      fechaAnalisis: generarTimestamp(),
      objetivo: urlRecibida,
      identidad: {
        titulo: datosDelRobot?.identidad?.titulo || MSG_SIN_TITULO,
        descripcion:
          datosDelRobot?.identidad?.descripcion || MSG_SIN_DESCRIPCION,
      },
      tecnologias: {
        servidor: datosDelRobot?.tecnologias?.servidor || MSG_DESCONOCIDO,
        lenguaje: datosDelRobot?.tecnologias?.lenguaje || MSG_DESCONOCIDO,
        frameworkFront:
          datosDelRobot?.tecnologias?.frameworkFront || MSG_DESCONOCIDO,
      },
      metricas: datosDelRobot?.metricas || {
        tiempoRespuestaMs: 0,
        pesoDocumentoKb: 0,
        certSslVigente: false,
      },
      enlaces: datosDelRobot?.enlaces || MSG_SIN_ENLACES,
      imagenes: datosDelRobot?.imagenes || MSG_SIN_IMAGENES,
    });
  } catch (error) {
    totalErrores++;

    const codigoError =
      error.message === ERR_INTERNO_TIMEOUT ? COD_TIMEOUT : COD_ERROR_SISTEMA;

    registrarLog("ERROR", "SISTEMA", error.message);

    return res
      .status(500)
      .json(respuestaError(codigoError, MSG_ERROR_REINTENTO));
  }
});

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
