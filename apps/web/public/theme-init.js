// Applique le thème avant le premier rendu (évite le flash clair → sombre). Fichier externe : compatible CSP.
(function () {
  var theme = 'system';
  try {
    theme = localStorage.getItem('taskflow-theme') || 'system';
  } catch (e) {}
  var dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
