const tabGroups = document.querySelectorAll("[data-tabs]");

tabGroups.forEach((group) => {
  const tabs = Array.from(group.querySelectorAll("[role='tab']"));
  const panels = Array.from(group.querySelectorAll("[role='tabpanel']"));

  const activateTab = (tab) => {
    tabs.forEach((candidate) => {
      const isActive = candidate === tab;
      candidate.setAttribute("aria-selected", String(isActive));
      candidate.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach((panel) => {
      panel.hidden = panel.id !== tab.getAttribute("aria-controls");
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (event) => {
      const keyMap = {
        ArrowLeft: index === 0 ? tabs.length - 1 : index - 1,
        ArrowRight: index === tabs.length - 1 ? 0 : index + 1,
        Home: 0,
        End: tabs.length - 1,
      };

      if (!(event.key in keyMap)) {
        return;
      }

      event.preventDefault();
      const nextTab = tabs[keyMap[event.key]];
      nextTab.focus();
      activateTab(nextTab);
    });
  });
});
