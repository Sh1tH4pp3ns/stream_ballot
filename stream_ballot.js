const storeKey = "sh143_stream_ballot";
let options = {};
const values = {};
let tiers = {};
let maxDigits = 2;
let matchLogic = "exact";
let active = false;
let twitchToken = "";
let providerId = "";
let rewards = {};
const scope = "channel:manage:redemptions";
const subscription = "channel.channel_points_custom_reward_redemption.add";
const subscriptionVersion = "1";
let eventSubConnected = false;

window.addEventListener('onEventReceived', function (obj) {
  console.log("onEventReceived", obj.detail);
  if (!obj.detail.event) {
    return;
  }
  if (typeof obj.detail.event.itemId !== "undefined") {
    obj.detail.listener = "redemption-latest"
  }
  
  const listener = obj.detail.listener || obj.detail.name;
  const event = obj.detail.event || obj.detail.data;
  

  if (listener === 'tip-latest') {
    add(event.message, event.amount);
  }
  else if(listener === 'cheer-latest') {
    add(event.message, event.amount / 100);
  }
  else if(listener === 'subscriber-latest') {
    add(event.message, tiers[event.tier]);
  }
  else if(event.listener === "widget-button") {
    if(event.field === "sh143_stream_ballotReset") {
      for(option in options) {
        options[option] = 0;
      }
      update();
    }
    else if(event.field === "sh143_stream_Add") {
      Object.entries(values).forEach(([key, value]) => options[key] += value);
      update();
    }
    else if(event.field === "sh143_stream_Set") {
      options = {...options, ...values};
      update();
    }
    else if(event.field === "sh143_stream_Start") {
      if(!active) {
        initRewards();
      }
      
      active = true;
      update();
    }
    else if(event.field === "sh143_stream_Stop") {
      if(active) {
        initRewards();
      }
      
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
  
  options[option] += amount;
  update();
}

function trimDigits(val, digits = 2) {
  return Math.round(val * (10 ** digits)) / (10 ** digits);
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
      return message.split(" ").find(part => part in options);
    case "containsCaseInsensitive":
      const lowerOptions = Object.fromEntries(Object.keys(options).map(option => [option.toLowerCase(), option]));
      return message.toLowerCase().split(" ").map(part => lowerOptions[part]).find(option => option !== undefined);
      
    default:
      return undefined;
  }
}

function update(save = true, animate = true) {
  const sum = Object.values(options).reduce((a,b) => a+b, 0);
  Object.entries(options).forEach(([option, val]) => {
    document.querySelector(`#${option}-absolute`).textContent = trimDigits(val);
    
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

function connectEventSub({token, client_id, user_id, rewards}) {
  if(eventSubConnected) {
    return;
  }
  
  eventSubConnected = true;
  
  console.log("Connecting to EventSub");
  
  const ws = new WebSocket("wss://eventsub-beta.wss.twitch.tv/ws");
  ws.onmessage = (message) => {
    const data  = JSON.parse(message.data);
    const { message_type }  = data.metadata;
    
    if(message_type === "session_welcome") {
      console.log("message", data);
      const session_id = data.payload.session.id;
      twitchCreateEventSubscription(token, client_id, user_id, session_id)
    }
    else if(message_type === "notification" && data.payload.subscription.type === subscription) {
      console.log("message", data);
      const { reward } = data.payload.event;
      const redemption_id = data.payload.event.id;
      const option = Object.keys(options).find(option => rewardName(option) === reward.title);
      
      if(option) {
        add(option, 1);
        twitchFulfillRedemption(token, client_id, user_id, reward.id, redemption_id);
      }
    }
    else if(message_type === "session_keepalive") {
      
    }
    else {
      console.log("message", data);
    }
    
  }
}

function twitchCreateEventSubscription(token, client_id, user_id, session_id) {
  const options = {
    method: 'POST',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      type: subscription,
      version: subscriptionVersion,
      condition: {
        broadcaster_user_id: user_id
      },
      transport: {
        method: "websocket",
        session_id: session_id
      }
    })
  };
  
  console.log("options", options);

  fetch('https://api.twitch.tv/helix/eventsub/subscriptions', options)
    .then(response => unwrapResponse(response))
    .then(response => console.log(response))
    .catch(err => console.error(err));
}

function twitchFulfillRedemption(token, client_id, user_id, reward_id, redemption_id) {
  const options = {
    method: 'PATCH',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      status: "CANCELED"
    })
  };

  fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${user_id}&reward_id=${reward_id}&id=${redemption_id}`, options)
}

function initRewards() {
  twitchValidate(twitchToken)
    .then(validate => twitchReadRewards(validate))
    .then(rewardResponse => createRewards(rewardResponse))
    .then(rewards => connectEventSub(rewards))
    .catch(error => console.error(error));
}

function rewardName(option) {
  return `Chat's Choice: ${option}`;
}

function createRewards({token, client_id, user_id, fetchedRewards}) {
  const neededRewards = Object.keys(options).map(option => rewardName(option));
  const unusedRewards = Object.values(fetchedRewards).filter(reward => !neededRewards.includes(reward.title));
  console.log({fetchedRewards, neededRewards, unusedRewards});
  
  const promises = neededRewards.map(title => {
    if(!(title in fetchedRewards)) {
      const unusedReward = unusedRewards.pop();
      if(unusedReward) {
        // rename reward
        console.log("updating from:", unusedReward.title, "to", title);
        return twitchUpdateReward(token, client_id, user_id, unusedReward, {title});
      }
      else {
        // create new reward
        console.log("creating", title);
        return twitchCreateReward(token, client_id, user_id, title);
      }
    }
    else {
      console.log("updating existing", fetchedRewards[title]);
      return twitchUpdateReward(token, client_id, user_id, fetchedRewards[title]);
    }
  }) || [];
  
  unusedRewards.forEach(unused => {
    console.log("deleting unused", unused.title);
    twitchDeleteReward(token, client_id, user_id, unused);
  });
  
  
  return Promise.all(promises)
    .then(rewards => { return {token, client_id, user_id, rewards: Object.fromEntries(rewards.map(reward => [reward.title, reward]) || [] ) } });
}

function twitchCreateReward(token, client_id, user_id, title) {
  const options = {
    method: 'POST',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
        title: title,
        prompt: "Test für Sh1t.",
        cost: 1,
        is_user_input_required: false,
        is_enabled: active,
        is_max_per_user_per_stream_enabled: false,
        max_per_user_per_stream: 2,
        is_paused: false,
        is_in_stock: true,
        background_color: "#FF8280"
    })
  };

  return fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${user_id}`, options)
    .then(response => unwrapResponse(response))
    .then(response => response.data[0]);
}

function twitchUpdateReward(token, client_id, user_id, reward, update = {}) {
  const body = { is_enabled: active, ...update };
  const noChanges = Object.entries(body).reduce((result, [key, value]) => result && reward[key] === value, true);
  if(noChanges) {
    return reward;
  }
  
  const options = {
    method: 'PATCH',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  };

  return fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${user_id}&id=${reward.id}`, options)
    .then(response => unwrapResponse(response))
    .then(response => response.data[0]);
}

function twitchDeleteReward(token, client_id, user_id, reward) {
  const options = {
    method: 'DELETE',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };

  return fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${user_id}&id=${reward.id}`, options);
}

function twitchReadRewards({token, client_id, user_id}) {
  const options = {
    method: 'GET',
    headers: {
      'Client-Id': client_id,
      Authorization: `Bearer ${token}`
    }
  };

  return fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?only_manageable_rewards=true&broadcaster_id=${user_id}`, options)
    .then(response => unwrapResponse(response))
    .then(response => { return {token, client_id, user_id, fetchedRewards: Object.fromEntries(response.data.map(reward => [reward.title, reward])) } });
}

function twitchValidate(token) {
  const options = {
    method: 'GET',
    headers: {Authorization: `Bearer ${token}`}
  };

  return fetch('https://id.twitch.tv/oauth2/validate', options)
    .then(response => unwrapResponse(response))
    .then(response => {
    if(response.user_id !== providerId) {
      console.error("Token and StreamElements channel Ids are differing", response.user_id, providerId);
    }
    
    if(!response.scopes.includes(scope)) {
      throw `Scope "${scope}" missing in token`;
    }
    
    return {token, client_id: response.client_id, user_id: response.user_id};
  });
}

function unwrapResponse(response) {
  if([200, 202, 204].includes(response.status)) {
    return response.json();
  }

  throw response;
}

window.addEventListener('onWidgetLoad', function (obj) {
  console.log("onWidgetLoad", obj.detail);
  const {fieldData} = obj.detail;
  maxDigits = fieldData["maxDigits"];
  matchLogic = fieldData["matchLogic"];
  twitchToken = fieldData["twitchToken"];
  providerId = obj.detail.channel.providerId;
  tiers = {
    prime: fieldData["tier1"],
    1: fieldData["tier1"],
    1000: fieldData["tier1"],
    2: fieldData["tier2"],
    2000: fieldData["tier2"],
    3: fieldData["tier3"],
    3000: fieldData["tier3"]
  }
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
    initRewards();
  });
  
});
