import './img/icon-128.png';

chrome.devtools.panels.create("RSocket Frames",
  'icon-128.png',
  `inspector.html`,
  function (panel) {
  }
);
