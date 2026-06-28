// script,js -- ARCHIVO EMISOR 2.0 - FRONTEND-
const inputObjetivo = document.getElementById("target-url");
const botonEscaneo = document.getElementById("btn-scan");
const panelVista = document.querySelector("#panel-vista .contenido-panel");
const panelTech = document.querySelector("#panel-tech .contenido-panel");
const panelEnlaces = document.querySelector("#panel-enlaces .contenido-panel");
const panelMetricas = document.querySelector(
  "#panel-metricas .contenido-panel",
);
let controladorPeticion;
botonEscaneo.addEventListener("click", iniciarOperacion);

async function iniciarOperacion() {
  if (controladorPeticion) {
    controladorPeticion.abort();
  }
  let urlIngresada = inputObjetivo.value.trim();
  if (
    !urlIngresada.startsWith("https://") &&
    !urlIngresada.startsWith("http://")
  )
    urlIngresada = "https://" + urlIngresada;

  try {
    new URL(urlIngresada);
  } catch (error) {
    panelVista.innerHTML = `<article role="alert" style="background: var(--color-alerta); color: #000000; padding: 15px; text-aling: center; cursor: pointer;"><header><strong>[ERROR: FORMATO DE URL INVALIDO]</strong></header><p style="margin: 8px 0 0 0; font-weight: bold;">(Hace clic en este cartel para limpiar y reintentar)</p></article>`;
    panelTech.innerHTML = "";
    panelEnlaces.innerHTML = "";
    panelMetricas.innerHTML = "";
    panelVista.querySelector("article").addEventListener("click", () => {
      panelVista.innerHTML = "";
      inputObjetivo.value = "";
      inputObjetivo.focus();
    });
    return;
  }
  panelVista.innerHTML = `<span style="color: var(--color-terminal)">[CONECTANDO SONDAS...]</span>`;
  panelTech.innerHTML = "";
  panelEnlaces.innerHTML = "";
  panelMetricas.innerHTML = "";
  controladorPeticion = new AbortController();
  try {
    const respuesta = await fetch("http://localhost:3000/api/escanear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlIngresada }),
      signal: controladorPeticion.signal,
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: ${datos.mensaje}]</span>`;
      panelTech.innerHTML = "";
      panelEnlaces.innerHTML = "";
      panelMetricas.innerHTML = "";
      return;
    }
    panelVista.innerHTML = `<span style="color: var(--color-terminal)">[${datos.mensaje}]</span>`;
    await new Promise((resolve) => setTimeout(resolve, 600));
    const tituloRecortado =
      datos.identidad.titulo.length > 50
        ? datos.identidad.titulo.substring(0, 47) + "..."
        : datos.identidad.titulo;
    const descripcionRecortada =
      datos.identidad.descripcion.length > 80
        ? datos.identidad.descripcion.substring(0, 77) + "..."
        : datos.identidad.descripcion;
    panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TITULO: <span style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCION: <span style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;

    await new Promise((resolve) => setTimeout(resolve, 300));
    panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: 
        <span style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: 
        <span style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: 
        <span style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;

    await new Promise((resolve) => setTimeout(resolve, 300));
    if (datos.enlaces && datos.enlaces.length > 0) {
      panelEnlaces.innerHTML =
        '<ul style="padding-left:15px;">' +
        datos.enlaces
          .slice(0, 15)
          .map((link) => `<li>${link}</li>`)
          .join("") +
        `</ul>`;
    } else {
      panelEnlaces.innerHTML =
        '<span style="color: var(--color-alerta)">No se encontraron enlaces.</span>';
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    const estadoSsl = datos.metricas.certSslVigente
      ? "Seguro (Activo)"
      : "Vulnerable (Caido)";
    panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: 
        <span style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO 
        TOTAL: <span style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb}KB</span></li>
        <li>ESTADO SSL: <span style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;
  } catch (error) {
    if (error.name === "AbortError") {
      panelVista.innerHTML = `<span style="color: var(--color-alerta)">[OPERACION CANCELADA POR EL OPERADOR]</span>`;
    } else {
      panelVista.innerHTML = `<span style="color: var(--color-alerta)">[FALLO DE CONEXION CON BUNKER CENTRAL]</span>`;
      console.log(error);
    }
    panelTech.innerHTML = "";
    panelEnlaces.innerHTML = "";
    panelMetricas.innerHTML = "";
  }
}
