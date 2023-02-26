const storeKey = "sh143_stream_ballot";
let options = {};
let maxDigits = 2;
let matchLogic = "exact";

window.addEventListener('onEventReceived', function (obj) {
    if (!obj.detail.event) {
      return;
    }
    if (typeof obj.detail.event.itemId !== "undefined") {
        obj.detail.listener = "redemption-latest"
    }
    const listener = obj.detail.listener.split("-")[0];
    const event = obj.detail.event;
  

  if (listener === 'tip') {
    add(event.message, event.amount);
  }
  else if(event.listener === "widget-button" && event.field === "sh143_stream_ballotReset") {
    reset();
  }
  
});

function reset() {
  for(option in options) {
    options[option] = 0;
  }

  update();
}

function add(message, amount) {
  option = match(message);
  if(!(option in options) || !amount) {
    return;
  }
  
  options[option] += amount;
  update();
}

function match(message) {
  switch(matchLogic) {
    case "exact":
      return Object.keys(options).find(key => message === key);
    case "caseInsensitive":
      return Object.keys(options).find(key => message.toLowerCase() === key.toLowerCase());
    case "startsWith":
      return Object.keys(options).find(key => message.startsWith(key));
    case "startsWithCaseInsensitive":
      return Object.keys(options).find(key => message.toLowerCase().startsWith(key.toLowerCase()));
    case "endsWith":
      return Object.keys(options).find(key => message.endsWith(key));
    case "endsWithCaseInsensitive":
      return Object.keys(options).find(key => message.toLowerCase().endsWith(key.toLowerCase()));
    case "contains":
      return Object.keys(options).find(key => message.includes(key));
    case "containsCaseInsensitive":
      return Object.keys(options).find(key => message.toLowerCase().includes(key.toLowerCase()));
      
    default:
      return undefined;
  }
}

function update(save = true, animate = true) {
  const sum = Object.values(options).reduce((a,b) => a+b, 0);
  Object.entries(options).forEach(([option, val]) => {
    document.querySelector(`#${option}-absolute`).textContent = val;
    
    const percent = sum > 0 ? (val/sum) * 100 : 0;
    const graph = document.querySelector(`#${option}-graph`);
    if(!animate) {
      graph.classList.add("noAnimation");
    }
    graph.style.width = `${percent}%`;
    if(!animate) {
      graph.offsetHeight;
      graph.classList.remove("noAnimation");
    }
    document.querySelector(`#${option}-relative`).textContent = `${Math.round(percent * (10 ** maxDigits)) / (10 ** maxDigits)}%`;
  });
  
  if(save) {
    const toBeSaved = Object.fromEntries(Object.entries(options).filter(([key, value]) => value));
    SE_API.store.set(storeKey, toBeSaved);
  }
}

window.addEventListener('onWidgetLoad', function (obj) {
  const {fieldData} = obj.detail;
  maxDigits = fieldData["maxDigits"];
  matchLogic = fieldData["matchLogic"];
  const optionKeys = [...new Set(fieldData["options"].split(",").map(option => option.trim()))].filter(option => option);
  const container = document.querySelector("#container");
  
  optionKeys.forEach(option => {
    const tr = document.createElement("tr");
    
    const name = document.createElement("td");
    name.textContent = option;
    name.classList.add("option");
    
    tr.appendChild(name);
    
    const spacer1 = document.createElement("td");
    spacer1.classList.add("spacer");
    
    tr.appendChild(spacer1);
    
    const graphCol = document.createElement("td");
    graphCol.classList.add("graphCol");
    
    tr.appendChild(graphCol);
    
    const graph = document.createElement("div");
    graph.id = `${option}-graph`;
    graph.style.width = "0%";
    graph.classList.add("graph");
    
    graphCol.appendChild(graph);
    
    const spacer2 = document.createElement("td");
    spacer2.classList.add("spacer");
    
    tr.appendChild(spacer2);
    
    const relative = document.createElement("td");
    relative.id = `${option}-relative`;
    relative.textContent = "0%";
    relative.classList.add("relative");
    
    tr.appendChild(relative);
    
    const spacer3 = document.createElement("td");
    spacer3.classList.add("relativeSpacer");
    
    tr.appendChild(spacer3);
    
    const absolute = document.createElement("td");
    absolute.id = `${option}-absolute`;
    absolute.textContent = 0;
    absolute.classList.add("absolute");
    
    tr.appendChild(absolute);
    
    container.appendChild(tr);
    
    options[option] = 0;
  });
  
  SE_API.store.get(storeKey).then(obj => {
    const savedEntries = Object.fromEntries(Object.entries(obj || {}).filter(([key, value]) => key in options));
    options = {...options, ...savedEntries};
    
    update(false, false);
  });
  
});
