(() => {
  const hydrateFigure = (hash = window.location.hash) => {
    if (!hash || hash.length < 2) return;

    const id = decodeURIComponent(hash.slice(1));
    const lightbox = document.getElementById(id);
    if (!lightbox || !lightbox.classList.contains("figure-lightbox")) return;

    const image = lightbox.querySelector("img");
    const source = lightbox.querySelector("figcaption a[href]");
    const fullSrc = source?.getAttribute("href");

    if (!image || !fullSrc || image.dataset.fullLoaded === "true") return;

    image.dataset.fullLoaded = "pending";

    const fullImage = new Image();
    fullImage.decoding = "async";
    fullImage.onload = () => {
      image.src = fullSrc;
      image.dataset.fullLoaded = "true";
    };
    fullImage.onerror = () => {
      image.dataset.fullLoaded = "error";
    };
    fullImage.src = fullSrc;
  };

  window.addEventListener("hashchange", () => hydrateFigure());
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('a[href^="#"]');
    if (!trigger) return;
    window.requestAnimationFrame(() => hydrateFigure(trigger.hash));
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => hydrateFigure());
  } else {
    hydrateFigure();
  }
})();
