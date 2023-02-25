const options = {};
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
    Object.keys(options).forEach(option => {
      document.querySelector(`#${option}-absolute`).textContent = 0;
      options[option] = 0;
      SE_API.store.set(storeKey(option), 0);
    });
    
    updateRelative();
  }
  
});

function add(message, amount) {
  [option, val] = match(message);
  if(!option || !amount) {
    return;
  }
  
  set(option, val + amount);
}

function set(option, val) {
  if(!(option in options) || !val) {
    return;
  }
  
  options[option] = val;
  document.querySelector(`#${option}-absolute`).textContent = val;
  SE_API.store.set(storeKey(option), val);
  
  updateRelative();
}

function match(message) {
  switch(matchLogic) {
    case "exact":
      return [message, options[message]];
    case "caseInsensitive":
      return Object.entries(options).find(([key, value]) => message.toLowerCase() === key.toLowerCase()) || [];
    case "startsWith":
      return Object.entries(options).find(([key, value]) => message.startsWith(key)) || [];
    case "startsWithCaseInsensitive":
      return Object.entries(options).find(([key, value]) => message.toLowerCase().startsWith(key.toLowerCase())) || [];
    case "endsWith":
      return Object.entries(options).find(([key, value]) => message.endsWith(key)) || [];
    case "endsWithCaseInsensitive":
      return Object.entries(options).find(([key, value]) => message.toLowerCase().endsWith(key.toLowerCase())) || [];
    case "contains":
      return Object.entries(options).find(([key, value]) => message.includes(key)) || [];
    case "containsCaseInsensitive":
      return Object.entries(options).find(([key, value]) => message.toLowerCase().includes(key.toLowerCase())) || [];
      
    default:
      return [];
  }
}

function updateRelative() {
  const sum = Object.values(options).reduce((a,b) => a+b, 0);
  Object.entries(options).forEach(([option, val]) => {
    const percent = sum > 0 ? (val/sum) * 100 : 0;
    document.querySelector(`#${option}-graph`).style.width = `${percent}%`;
    document.querySelector(`#${option}-relative`).textContent = `${Math.round(percent * (10 ** maxDigits)) / (10 ** maxDigits)}%`;
  });
}

function storeKey(option) {
  return `sh143_stream_ballot_${option}`;
}

window.addEventListener('onWidgetLoad', function (obj) {
  const {fieldData} = obj.detail;
  maxDigits = fieldData["maxDigits"];
  matchLogic = fieldData["matchLogic"];
  optionKeys = [...new Set(fieldData["options"].split(",").map(option => option.trim()))].filter(option => option);
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
    SE_API.store.get(storeKey(option)).then(obj => set(option, obj?.value));
  });
  
});
