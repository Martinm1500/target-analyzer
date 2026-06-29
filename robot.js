const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

async function ejecutarExtraccion(urlObjetivo) {
  let navegador;
  try {
    navegador = await puppeteer.launch({ headless: "shell" });
    const pagina = await navegador.newPage();

    // Viewport definido antes de navegar para que el screenshot sea consistente
    await pagina.setViewport({ width: 1280, height: 800 });

    const tiempoInicio = Date.now();

    // networkidle2 en vez de domcontentloaded para capturar imágenes dinámicas
    const respuestaRed = await pagina.goto(urlObjetivo, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });

    // Screenshot de página completa en base64
    const screenshotBase64 = await pagina.screenshot({
      fullPage: true,
      encoding: "base64",
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

    // Enlaces
    const enlaces = [];
    $("a").each((i, elemento) => {
      const href = $(elemento).attr("href");
      if (href) enlaces.push(href);
    });

    // Imágenes — src resuelto a URL absoluta
    const imagenes = [];
    $("img").each((i, elemento) => {
      const src = $(elemento).attr("src");
      const alt = $(elemento).attr("alt") || "Sin alt";
      if (src) {
        try {
          const srcAbsoluto = new URL(src, urlObjetivo).href;
          imagenes.push({ src: srcAbsoluto, alt });
        } catch {
          imagenes.push({ src, alt });
        }
      }
    });

    // Imágenes de fondo en estilos inline
    $("[style]").each((i, el) => {
      const style = $(el).attr("style") || "";
      const match = style.match(
        /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i,
      );
      if (match) {
        try {
          const srcAbsoluto = new URL(match[1], urlObjetivo).href;
          imagenes.push({ src: srcAbsoluto, alt: "background" });
        } catch {
          imagenes.push({ src: match[1], alt: "background" });
        }
      }
    });

    // Detección de framework
    let frameworkFront = "Desconocido";
    if ($("[data-reactroot], #root").length > 0) frameworkFront = "React";
    else if ($("[data-v-app], #app").length > 0) frameworkFront = "Vue";
    else if ($("[ng-version], [ng-app]").length > 0) frameworkFront = "Angular";

    // Detección de lenguaje/CMS
    let lenguaje = "HTML Estático / Desconocido";
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
        servidor,
        lenguaje,
        frameworkFront,
      },
      metricas: {
        tiempoRespuestaMs,
        pesoDocumentoKb,
        certSslVigente,
      },
      enlaces: enlaces.slice(0, 20),
      imagenes: imagenes.slice(0, 20),
      // Listo para usar directamente en <img src="...">
      screenshot: `data:image/png;base64,${screenshotBase64}`,
    };
  } catch (error) {
    if (navegador) {
      await navegador.close();
    }
    throw new Error(
      "Falla en la intercepción de datos. Objetivo inalcanzable.",
    );
  }
}

module.exports = ejecutarExtraccion;
