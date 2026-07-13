(() => {
  document.documentElement.classList.add("js");

  const navToggle = document.querySelector(".nav-toggle");
  const siteNavigation = document.getElementById("site-navigation");

  const setMenuState = (isOpen) => {
    if (!navToggle || !siteNavigation) return;

    navToggle.setAttribute("aria-expanded", String(isOpen));
    siteNavigation.toggleAttribute("data-open", isOpen);
  };

  navToggle?.addEventListener("click", () => {
    setMenuState(navToggle.getAttribute("aria-expanded") !== "true");
  });

  siteNavigation?.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenuState(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) setMenuState(false);
  });

  let lastFigureTrigger = null;

  const getLightboxFromHash = (hash = window.location.hash) => {
    if (!hash || hash.length < 2) return null;

    const id = decodeURIComponent(hash.slice(1));
    const lightbox = document.getElementById(id);
    if (!lightbox || !lightbox.classList.contains("figure-lightbox")) return null;

    return lightbox;
  };

  const hydrateFigure = (hash = window.location.hash) => {
    const lightbox = getLightboxFromHash(hash);
    if (!lightbox) return;

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

  const closeLightbox = () => {
    const lightbox = getLightboxFromHash();
    if (!lightbox) return;

    const closeTarget = lightbox.querySelector(".figure-lightbox__close")?.hash || "#papers";
    window.location.hash = closeTarget;

    window.requestAnimationFrame(() => {
      if (lastFigureTrigger) {
        lastFigureTrigger.focus({ preventScroll: true });
        lastFigureTrigger = null;
      }
    });
  };

  window.addEventListener("hashchange", () => hydrateFigure());

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('a[href^="#"]');
    if (!trigger) return;

    const lightbox = getLightboxFromHash(trigger.hash);
    if (lightbox) {
      lastFigureTrigger = trigger;
    }

    window.requestAnimationFrame(() => hydrateFigure(trigger.hash));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuState(false);
      closeLightbox();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => hydrateFigure());
  } else {
    hydrateFigure();
  }
})();
