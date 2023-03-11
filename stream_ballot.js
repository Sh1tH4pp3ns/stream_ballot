const storeKey = "sh143_stream_ballot";
const scope = "channel:manage:redemptions";
const subscription = "channel.channel_points_custom_reward_redemption.add";
const subscriptionVersion = "1";

const se = {};
const widget = {
  eventSubConnected: false
};

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
    const redeemedOption = add(event.message, event.amount, event.name);
    if(redeemedOption) {
      botSay(`fukiHype ${event.name} stimmt mit ${event.amount} € für ${redeemedOption} fukiHype`); 
    };
  }
  else if(listener === 'cheer-latest') {
    const redeemedOption = add(event.message, event.amount / 100, event.name);
    
    if(redeemedOption) {
      botSay(`fukiHype ${event.name} stimmt mit ${event.amount} Bits für ${redeemedOption} fukiHype`); 
    };
  }
  else if(listener === 'subscriber-latest') {
    if(event.isCommunityGift) {
      // skip single gift events
      return;
    }
    const name = event.gifted ? event.sender : event.name;
    const subCount = event.bulkGifted ? event.amount : 1;
    const value = tiers[event.tier] * subCount;

    const redeemedOption = add(event.message, value, name);
    
    if(redeemedOption) {
      botSay(`fukiHype ${name} stimmt mit ${subCount <= 1 ? "einem" : subCount} ${event.gifted || event.bulkGifted ? "Gift-" : ""}Sub${subCount <= 1 ? "" : "s"} für ${redeemedOption} fukiHype`); 
    };
  }
  else if(event.listener === "widget-button") {
    if(event.field === "sh143_stream_ballotReset") {
      for(option in widget.options) {
        widget.options[option] = 0;
      }
      update();
    }
    else if(event.field === "sh143_stream_Add") {
      Object.entries(widget.values).forEach(([key, value]) => widget.options[key] += value);
      update();
    }
    else if(event.field === "sh143_stream_Set") {
      widget.options = {...widget.options, ...widget.values};
      update();
    }
    else if(event.field === "sh143_stream_Start") {
      if(!widget.active) {
        updateRewards();
      }

      widget.active = true;
      update();
    }
    else if(event.field === "sh143_stream_Stop") {
      if(widget.active) {
        updateRewards();
      }
      
      widget.active = false;
      update();
    }
  }
  
});

function add(message, amount, username) {
  const option = match(message);
  if(!(option in widget.options) || !amount || !active) {
    
    if(amount && active) {
      const name = username.toLowerCase();
      widget.wasted[name] = (widget.wasted[name] ?? 0) + amount;
      save();

      if(!isEditorMode) {
        botSay(`@${username} dein Support konnte leider nicht zugeordnet werden, du kannst ihn aber per Twitch-Reward einlösen. !choice für mehr Infos.`);
      }
    }
    
    return;
  }
  
  widget.options[option] += amount;
  update();
  return option;
}

function trimDigits(val, digits = 2) {
  return Math.round(val * (10 ** digits)) / (10 ** digits);
}

function match(message) {
  switch(se.fieldData.matchLogic) {
    case "exact":
      return Object.keys(widget.options).find(key => message === key);
    case "caseInsensitive":
      return Object.keys(widget.options).find(key => message.toLowerCase() === key.toLowerCase());
    case "startsWith":
      return Object.keys(widget.options).find(key => message.startsWith(key));
    case "startsWithCaseInsensitive":
      return Object.keys(widget.options).find(key => message.toLowerCase().startsWith(key.toLowerCase()));
    case "endsWith":
      return Object.keys(widget.options).find(key => message.endsWith(key));
    case "endsWithCaseInsensitive":
      return Object.keys(widget.options).find(key => message.toLowerCase().endsWith(key.toLowerCase()));
    case "contains":
      return Object.keys(widget.options).map(o => [message.indexOf(o), o]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0]).map(x => x[1])[0];
    case "containsCaseInsensitive":
      const lowerOptions = Object.fromEntries(Object.keys(widget.options).map(option => [option.toLowerCase(), option]));
      const found = Object.keys(lowerOptions).map(o => [message.toLowerCase().indexOf(o), o]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0]).map(x => x[1])[0];
      return lowerOptions[found];
      
    default:
      return undefined;
  }
}

function update(saveStatus = true, animate = true) {
  const sum = Object.values(widget.options).reduce((a,b) => a+b, 0);
  Object.entries(widget.options).forEach(([option, val]) => {
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
    document.querySelector(`#${option}-relative`).textContent = `${trimDigits(percent, se.fieldData.maxDigits)}%`;
  });
  
  const overlay = document.querySelector("#overlay");
  overlay.style.display = active ? "none" : "flex";
  
  if(saveStatus) {
    save();
  }
}
  
function botSay(message) {
  if(se.overlay.isEditorMode) {
    console.log("Chat-Message:", message);
    return;
  }
  
  const token = se.fieldData.seToken;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      message: message
    })
  };

  fetch(`https://api.streamelements.com/kappa/v2/bot/${se.channel.id}/say`, options);
}

function save() {
  const toBeSaved = Object.fromEntries(Object.entries(widget.options).filter(([key, value]) => value));
  SE_API.store.set(storeKey, {active: widget.active, options: toBeSaved, wasted: widget.wasted});
}

function connectEventSub({token, client_id, user_id}, url = "wss://eventsub-beta.wss.twitch.tv/ws") {
  if(widget.eventSubConnected) {
    return;
  }
  
  widget.eventSubConnected = true;
  
  const ws = new WebSocket(url);
  ws.onmessage = async (message) => {
    const data  = JSON.parse(message.data);
    const { message_type }  = data.metadata;
    
    if(message_type === "session_welcome") {
      const session_id = data.payload.session.id;
      const subCreated = await twitchCreateEventSubscription(token, client_id, user_id, session_id);
      
      if(!isEditorMode && subCreated) {
        // make options visible
        
      }
    }
    else if(message_type === "notification" && data.payload.subscription.type === subscription) {
      const { reward, user_name } = data.payload.event;
      const redemption_id = data.payload.event.id;
      const option = Object.keys(widget.options).find(option => rewardName(option) === reward.title);
      
      if(option) {
        const name = user_name.toLowerCase();
        if(name in widget.wasted) {
          const amount = widget.wasted[name];
          delete widget.wasted[name];
          
          add(option, amount, user_name);
          
          if(!se.overlay.isEditorMode) {
            botSay(`fukiHype ${user_name} löst verlorene ${amount} € für ${option} ein, erhält die Kanalpunkte zurück und kann noch einmal abstimmen fukiHype`);
            twitchCancelRedemption(token, client_id, user_id, reward.id, redemption_id);
          }
        }
        else {
          add(option, se.fieldData.rewardValue, user_name);
          
          if(!se.overlay.isEditorMode) {
            botSay(`fukiHype ${user_name} stimmt per Twitch-Reward für ${option} fukiHype`);
            twitchFulfillRedemption(token, client_id, user_id, reward.id, redemption_id);
          }
        }
      }
    }
    else if(message_type === "session_keepalive") {
      
    }
    else if(message_type === "session_reconnect") {
      const { reconnect_url } = data.payload.session;
      widget.eventSubConnected = false;
      connectEventSub(reconnect_url);
      
      setTimeout(() => ws.close(), 1500);
    }
    else {
      console.log("message", data);
    }
    
  }
}

async function twitchCreateEventSubscription(token, client_id, user_id, session_id) {
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

  const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', options);
  return response.ok;
}

async function twitchCancelRedemption(token, client_id, user_id, reward_id, redemption_id) {
  await twitchUpdateRedemptionStatus(token, client_id, user_id, reward_id, redemption_id, "CANCELED");
}

async function twitchFulfillRedemption(token, client_id, user_id, reward_id, redemption_id) {  
  await twitchUpdateRedemptionStatus(token, client_id, user_id, reward_id, redemption_id, "FULFILLED");
}

async function twitchUpdateRedemptionStatus(token, client_id, user_id, reward_id, redemption_id, status) {
  if(se.overlay.isEditorMode) {
    return;
  }

  const options = {
    method: 'PATCH',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      status: status
    })
  };

  await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${user_id}&reward_id=${reward_id}&id=${redemption_id}`, options);
}

async function updateRewards() {
  try {
    const token = se.fieldData.twitchToken;
    const rewardPerOption = true;
    
    const { client_id, user_id } = await twitchValidate(token);
    
    if(!se.overlay.isEditorMode) {
      const existingRewards = await twitchReadRewards(token, client_id, user_id);
      const rewardPlan = planRewards(options, existingRewards, rewardPerOption);
      await applyRewardPlan(token, client_id, user_id, rewardPlan);
    }
    
    // connect to EventSub
    connectEventSub({token, client_id, user_id});
  }
  catch (error) {
    console.error(error);
  }
  
}

async function applyRewardPlan(token, client_id, user_id, rewardPlan) {
  if(se.overlay.isEditorMode) {
    return;
  }

  for (const reward of rewardPlan.delete) {
    await twitchDeleteReward(token, client_id, user_id, reward);
  }
  
  const promises = [];
  rewardPlan.update.forEach(update => promises.push(twitchUpdateReward(token, client_id, user_id, update.reward, {title: update.title})));
  rewardPlan.create.forEach(title => promises.push(twitchCreateReward(token, client_id, user_id, title, rewardPlan.rewardPerOption)));
  
  await Promise.all(promises);
}

function rewardName(option) {
  return `Chat's Choice: ${option}`;
}

function planRewards(options, rawRewards, rewardPerOption) {
  const neededRewards = rewardPerOption ? Object.keys(options).map(option => rewardName(option)) : ["Chat's Choice"];
  const existingRewards = Object.fromEntries(rawRewards.map(reward => [reward.title, reward]));
  const unusedRewards = rawRewards.filter(reward => !neededRewards.includes(reward.title));
  
  const create = [];
  const update = [];
  const deleteRewards = [];
  
  neededRewards.forEach(title => {
    if(!(title in existingRewards)) {
      const unusedReward = unusedRewards.pop();
      if(unusedReward) {
        // rename reward
        update.push({ title, reward: unusedReward });
      }
      else {
        // create new reward
        create.push(title);
      }
    }
    else {
      // update reward with matching title
      update.push({ title, reward: existingRewards[title] });
    }
  });
  
  unusedRewards.forEach(unused => {
    // delete this reward
    deleteRewards.push(unused);
  });
  
  return { create, update, delete: deleteRewards };
}

async function twitchCreateReward(token, client_id, user_id, title) {
  const options = {
    method: 'POST',
    headers: {
      'Client-Id': client_id,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
        title: title,
        prompt: "",
        cost: se.fieldData.rewardCost,
        is_user_input_required: false,
        is_enabled: active,
        is_max_per_user_per_stream_enabled: se.fieldData.rewardLimit,
        max_per_user_per_stream: se.fieldData.rewardLimitNumber,
        is_paused: false,
        is_in_stock: true,
        background_color: "#FF8280"
    })
  };

  const response = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${user_id}`, options);
  const result = await unwrapResponse(response);
  
  return result.data[0]
}

async function twitchUpdateReward(token, client_id, user_id, reward, update = {}) {
  const body = { 
    prompt: "",
    cost: twitchReward.cost,
    is_user_input_required: false,
    is_enabled: active,
    is_max_per_user_per_stream_enabled: se.fieldData.rewardLimit,
    max_per_user_per_stream: se.fieldData.rewardLimitNumber,
    is_paused: false,
    is_in_stock: true,
    background_color: "#FF8280",
    ...update
  };
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

  const response = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${user_id}&id=${reward.id}`, options);
  const result = await unwrapResponse(response);
  
  return result.data[0];
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

async function twitchReadRewards(token, client_id, user_id) {
  const options = {
    method: 'GET',
    headers: {
      'Client-Id': client_id,
      Authorization: `Bearer ${token}`
    }
  };
  
  const response = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?only_manageable_rewards=true&broadcaster_id=${user_id}`, options);
  const result = await unwrapResponse(response);
  
  return result.data || [];
}

async function twitchValidate(token) {
  const options = {
    method: 'GET',
    headers: {Authorization: `Bearer ${token}`}
  };

  const response = await fetch('https://id.twitch.tv/oauth2/validate', options);
  const result = await unwrapResponse(response);
  
  if(result.user_id !== se.channel.providerId) {
    console.error("Token and StreamElements channel Ids are differing", result.user_id, se.channel.providerId);
  }

  if(!result.scopes.includes(scope)) {
    throw `Scope "${scope}" missing in token`;
  }
  
  return result;
}

async function unwrapResponse(response) {
  if(!response.ok) {
    throw response;
  }
  
  return await response.json();
}

window.addEventListener('onWidgetLoad', async function (obj) {
  Object.entries(obj.detail).forEach(([key, value]) => se[key] = value);

  se.fieldData.rewardLimit ||= false;
  se.fieldData.rewardLimitNumber ||= 1;

  widget.tiers = {
    prime: se.fieldData.tier1,
    1: se.fieldData.tier1,
    1000: se.fieldData.tier1,
    2: se.fieldData.tier2,
    2000: se.fieldData.tier2,
    3: se.fieldData.tier3,
    3000: se.fieldData.tier3
  }
  
  const optionKeys = [...new Set(se.fieldData.options.split(",").map(option => option.trim()))].filter(option => option);
  const filteredValues = se.fieldData.values.split(",").map(x => parseFloat(x)).map(x => isNaN(x) ? undefined : x);
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
    
    switch(se.fieldData.percentagePosition) {
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
    
    widget.options[option] = 0;
    const value = filteredValues[index]
    if(typeof value === "number") {
      se.widget.values[option] = trimDigits(value);
    }
  });
  
  SE_API.store.get(storeKey).then(obj => {
    widget.active = obj?.active || false;
    widget.wasted = obj?.wasted || {};
    const savedEntries = Object.fromEntries(Object.entries(obj?.options || {}).filter(([key, value]) => key in widget.options));
    widget.options = {...widget.options, ...savedEntries};
    
    update(false, false);
    updateRewards();
  });
  
});
