/* Site-wide settings. Edit here, no other file needs to change. */
window.GCC_CONFIG = {
  // Where the progress API lives. Same origin by default (the Docker image serves both).
  // Set to null to run in "this device only" mode, e.g. on plain GitHub Pages.
  apiBase: '/api',
  // How long to wait after the last change before saving to the server (ms).
  saveDelay: 800
};
