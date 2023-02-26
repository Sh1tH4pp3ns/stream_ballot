const storeKey = "sh143_stream_ballot";
let options = {};
const values = {};
let maxDigits = 2;
let matchLogic = "exact";
let active = false;

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
  else if(event.listener === "widget-button") {
    if(event.field === "sh143_stream_ballotReset") {
      for(option in options) {
        options[option] = 0;
      }
      update();
    }
    else if(event.field === "sh143_stream_Set") {
      options = {...options, ...values};
      update();
    }
    else if(event.field === "sh143_stream_Start") {
      active = true;
      update();
    }
    else if(event.field === "sh143_stream_Stop") {
      active = false;
      update();
    }
  }
  
});

function add(message, amount) {
  option = match(message);
  if(!(option in options) || !amount || !active) {
    return;
  }
  
  options[option] += trimDigits(amount);
  update();
}

function trimDigits(val, digits = 2) {
  return Math.floor(val * (10 ** digits)) / (10 ** digits);
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
    document.querySelector(`#${option}-relative`).textContent = `${trimDigits(percent, maxDigits)}%`;
  });
  
  const overlay = document.querySelector("#overlay");
  overlay.style.display = active ? "none" : "flex";
  
  if(save) {
    const toBeSaved = Object.fromEntries(Object.entries(options).filter(([key, value]) => value));
    SE_API.store.set(storeKey, {active, options: toBeSaved});
  }
}

window.addEventListener('onWidgetLoad', function (obj) {
  const {fieldData} = obj.detail;
  maxDigits = fieldData["maxDigits"];
  matchLogic = fieldData["matchLogic"];
  const valueInput = fieldData["values"];
  const percentagePosition = fieldData["percentagePosition"];
  
  const optionKeys = [...new Set(fieldData["options"].split(",").map(option => option.trim()))].filter(option => option);
  const filteredValues = valueInput.split(",").map(x => parseFloat(x)).map(x => isNaN(x) ? undefined : x);
  const container = document.querySelector("#container");
  
  optionKeys.forEach((option, index) => {
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
    
    const graphWrapper = document.createElement("div");
    graphWrapper.classList.add("graphWrapper");
    graphCol.appendChild(graphWrapper);
    
    const graph = document.createElement("div");
    graph.id = `${option}-graph`;
    graph.style.width = "0%";
    graph.classList.add("graph");
    
    graphWrapper.appendChild(graph);
    
    const graphSpacer = document.createElement("div");
    graph.appendChild(graphSpacer);
    
    const spacer2 = document.createElement("td");
    spacer2.classList.add("spacer");
    
    tr.appendChild(spacer2);
    
    const relative = document.createElement("div");
    relative.id = `${option}-relative`;
    relative.textContent = "0%";
    relative.classList.add("relative");
    
    switch(percentagePosition) {
      case "insideCentered":
        graph.style["justify-content"] = "center";
        graphSpacer.style["min-width"] = "8px";
      case "inside":
        graph.appendChild(relative);
        break;
      case "beside":
        graphWrapper.appendChild(relative);
        break;
      case "fixed":
      default:
        const relativeCol = document.createElement("td");
        relativeCol.style.width = "1%";
      tr.appendChild(relativeCol);
        relativeCol.appendChild(relative);
        
        const spacer3 = document.createElement("td");
        spacer3.classList.add("spacer");
        
        tr.appendChild(spacer3);
    }   
    
    const absolute = document.createElement("td");
    absolute.id = `${option}-absolute`;
    absolute.textContent = 0;
    absolute.classList.add("absolute");
    
    tr.appendChild(absolute);
    
    container.appendChild(tr);
    
    options[option] = 0;
    if(typeof filteredValues[index] === "number") {
      values[option] = trimDigits(filteredValues[index]);
    }
  });
  
  SE_API.store.get(storeKey).then(obj => {
    active = obj?.active || false;
    
    const savedEntries = Object.fromEntries(Object.entries(obj?.options || {}).filter(([key, value]) => key in options));
    options = {...options, ...savedEntries};
    
    update(false, false);
  });
  
});
