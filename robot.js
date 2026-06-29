const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
async function ejecutarExtraccion(urlObjetivo) {
  let navegador;
  try {
    navegador = await puppeteer.launch({ headless: "shell" });
    const pagina = await navegador.newPage();
    const tiempoInicio = Date.now();
    const respuestaRed = await pagina.goto(urlObjetivo, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    const codigoHtml = await pagina.content();
    const tiempoRespuestaMs = Date.now() - tiempoInicio;
    const certSslVigente = respuestaRed.securityDetails() !== null;
    const pesoDocumentoKb = (
      Buffer.byteLength(codigoHtml, "utf8") / 1024
    ).toFixed(2);
    const $ = cheerio.load(codigoHtml);
    const tituloPagina = $("title").text().trim() || "Sin título";
    const descripcionPagina =
      $('meta[name="description"]').attr("content") || "Sin descripción";
    const enlaces = [];
    $("a").each((i, elemento) => {
      const href = $(elemento).attr("href");

      if (href) {
        enlaces.push(href);
      }
    });
    let frameworkFront = "Desconocido";
    if ($("[data-reactroot], #root").length > 0) frameworkFront = "React";
    else if ($("[data-v-app], #app").length > 0) frameworkFront = "Vue";
    else if ($("[ng-version], [ng-app]").length > 0) frameworkFront = "Angular";
    let lenguaje = "HTML Estatico / Desconocido";
    if (
      $('meta[name="generator"]')
        .attr("content")
        ?.toLowerCase()
        .includes("wordpress")
    ) {
      lenguaje = "PHP (WordPress)";
    }
    const servidor = respuestaRed.headers()["server"] || "Oculto";
    setTimeout(async () => {
      try {
        await navegador.close();
      } catch (e) {}
    }, 2000);
    return {
      identidad: {
        titulo: tituloPagina,
        descripcion: descripcionPagina,
      },
      tecnologias: {
        servidor: servidor,
        lenguaje: lenguaje,
        frameworkFront: frameworkFront,
      },
      metricas: {
        tiempoRespuestaMs: tiempoRespuestaMs,
        pesoDocumentoKb: pesoDocumentoKb,
        certSslVigente: certSslVigente,
      },
      enlaces: enlaces.slice(0, 20),
    };
  } catch (error) {
    if (navegador) {
      await navegador.close();
    }
    throw new Error(
      "Falla en la intercepcion de datos. Objetivo inalcanzable.",
    );
  }
}
module.exports = ejecutarExtraccion;
