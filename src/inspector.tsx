import React from 'react';
import ReactDOM from 'react-dom';
import './reset.css';
import App, {ChromeHandlers} from './viewer/App';

const handlers: ChromeHandlers = {};

declare let window: any;
if (!window.inspectors) {
  window.inspectors = []
}

type InspectorWindow = {
  id: number,
  active: boolean,
}

const inspectors: InspectorWindow[] = window.inspectors;

chrome.debugger.onDetach.addListener(({tabId}) => {
  const inspector = inspectors.find(({id}) => id === tabId);
  if (inspector) {
    inspector.active = false;
  }
});

let tabId = chrome.devtools.inspectedWindow.tabId;
const inspector = inspectors.find(({id}) => id === tabId);
if (inspector && inspector.active) {
  // skip
} else {
  chrome.debugger.attach({tabId: tabId}, "1.0", () => {
    if (chrome.runtime.lastError) {
      alert(chrome.runtime.lastError.message);
      return;
    }

    const inspector = inspectors.find(({id}) => id === tabId);
    if (inspector) {
      inspector.active = true;
      chrome.runtime.sendMessage({
        message: "reattach",
        tabId: tabId,
      });
    } else {
      inspectors.push({id: tabId, active: true});
    }
  });
}

function startDebugging() {
  chrome.debugger.sendCommand({tabId}, "Network.enable", undefined, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
    } else {
      console.log("Network enabled");
    }
  });
}

chrome.runtime.onMessage.addListener(message => {
  if (message.message === "reattach" && message.tabId === tabId) {
    startDebugging();
  }
});

chrome.debugger.onEvent.addListener((debuggee, message, params) => {
  if (debuggee.tabId !== tabId) {
    return;
  }

  if (handlers[message]) {
    handlers[message](params);
  }
});

window.addEventListener("load", function () {
  console.log("starting debugging")
  startDebugging();
});

ReactDOM.render(<App handlers={handlers}/>, document.getElementById('root'));
